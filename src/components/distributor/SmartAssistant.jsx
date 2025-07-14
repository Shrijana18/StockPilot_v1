import React, { useState, useEffect, useRef } from 'react';
import {
  collection,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from "../../firebase/firebaseConfig";

const checkRetailerConnected = async (retailerId, distributorId) => {
  const ref = doc(
    db,
    'businesses',
    distributorId,
    'connectedRetailers',
    retailerId
  );
  const snap = await getDoc(ref);
  return snap.exists();
};

const SmartAssistant = ({ distributor }) => {
  useEffect(() => {
    console.log("🧪 SmartAssistant Debug:");
    console.log("Retailer UID (auth):", auth.currentUser?.uid);
    console.log("Distributor ID (prop):", distributor?.id);
  }, [distributor]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [latestReply, setLatestReply] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [debouncedInput, setDebouncedInput] = useState('');
  const bottomRef = useRef(null);

  const retailerId = auth.currentUser?.uid;
  const distributorId = distributor?.id;

  useEffect(() => {
    if (!retailerId || !distributorId) return;

    const chatRef = collection(
      db,
      'businesses',
      distributorId,
      'connectedRetailers',
      retailerId,
      'assistantChats'
    );

    const q = query(chatRef, orderBy('timestamp'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chat = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(chat);
    });

    return () => unsubscribe();
  }, [retailerId, distributorId]);

  // Listen for latest assistant reply from assistantQueries, avoiding duplicates and race conditions
  useEffect(() => {
    if (!retailerId || !distributorId) return;

    const q = query(
      collection(db, "assistantQueries"),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const matchingDoc = snapshot.docs.find(
        (d) =>
          d.data().userId === retailerId &&
          d.data().distributorId === distributorId &&
          d.data().source === "SmartAssistant" &&
          d.data().reply
      );

      if (matchingDoc) {
        const replyText = matchingDoc.data().reply;
        const exists = messages.some(
          (msg) => msg.message === replyText && msg.sender === "assistant"
        );
        if (!exists) {
          const replyMessage = {
            id: `reply-${matchingDoc.id}`,
            message: replyText,
            sender: "assistant",
            timestamp: matchingDoc.data().timestamp
          };
          setMessages((prev) => [...prev, replyMessage]);
          setIsTyping(false);
        }
      }
    });

    return () => unsubscribe();
  }, [retailerId, distributorId, messages]);

  // Debounce effect for input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedInput(input.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [input]);

  // Query Firestore for suggestions
  useEffect(() => {
    if (!debouncedInput || !distributorId) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      const connected = await checkRetailerConnected(retailerId, distributorId);
      if (!connected) {
        setSuggestions([]);
        return;
      }

      const q = query(
        collection(db, "businesses", distributorId, "products")
      );

      try {
        const snapshot = await import('firebase/firestore').then(({ getDocs }) => getDocs(q));
        const matches = snapshot.docs
          .map(doc => doc.data().name)
          .filter(name => name?.toLowerCase().includes(debouncedInput.toLowerCase()));
        setSuggestions(matches.slice(0, 5));
      } catch (e) {
        console.error("Suggestion fetch error:", e);
        setSuggestions([]);
      }
    };

    fetchSuggestions();
  }, [debouncedInput, distributorId]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    if (!retailerId || !distributorId) {
      console.error("Missing retailerId or distributorId");
      return;
    }

    const newMessage = {
      message: input.trim(),
      sender: 'retailer',
      timestamp: serverTimestamp()
    };

    try {
      await addDoc(
        collection(
          db,
          'businesses',
          distributorId,
          'connectedRetailers',
          retailerId,
          'assistantChats'
        ),
        newMessage
      );
      await addDoc(collection(db, "assistantQueries"), {
        prompt: input.trim(),
        timestamp: serverTimestamp(),
        userId: retailerId,
        distributorId: distributorId,
        role: "retailer",
        source: "SmartAssistant"
      });
      setInput('');
      setIsTyping(true);
    } catch (err) {
      console.error('Failed to send message:', err.message);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="h-[500px] flex flex-col border rounded shadow p-4 bg-white relative">
      <div className="flex-1 overflow-y-auto space-y-2 mb-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`p-2 max-w-xs rounded ${
              msg.sender === 'retailer'
                ? 'bg-blue-100 self-end text-right'
                : 'bg-gray-100 self-start text-left'
            }`}
          >
            <p className="text-sm">{msg.message}</p>
            {msg.sender === 'assistant' && msg.timestamp && (
              <p className="text-[10px] text-gray-500 mt-1">✓ Delivered</p>
            )}
          </div>
        ))}
        {isTyping && (
          <div className="p-2 max-w-xs rounded bg-gray-100 self-start text-left animate-pulse">
            <p className="text-sm italic text-gray-500">Assistant is typing...</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex items-center gap-2 relative">
        <input
          type="text"
          className="flex-1 border rounded px-3 py-2 text-sm"
          placeholder="Ask something..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button
          onClick={sendMessage}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm"
        >
          Send
        </button>
        {suggestions.length > 0 && (
          <div className="absolute bottom-14 left-0 right-0 bg-white border rounded shadow text-sm z-10">
            {suggestions.map((s, i) => (
              <div
                key={i}
                onClick={() => {
                  setInput(s);
                  setSuggestions([]);
                }}
                className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
              >
                {s}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartAssistant;
