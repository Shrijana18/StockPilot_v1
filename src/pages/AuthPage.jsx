import React, { useContext, useEffect, useState } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { AuthContext } from '/src/context/AuthContext';
import Register from "../components/Register";
import Login from "../components/Login";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

const AuthPage = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const type = searchParams.get("type");

  const [selectedRole, setSelectedRole] = useState("");
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  useEffect(() => {
    if (!type) {
      navigate("/auth?type=login", { replace: true });
      return;
    }
  }, [type, navigate]);

  useEffect(() => {
    const checkUserRoleAndRedirect = async () => {
      if (!user) {
        setIsLoadingUser(false);
        return;
      }

      try {
        const docRef = doc(db, "businesses", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const userData = docSnap.data();
          const role = userData.role?.toLowerCase();

          if (role === "retailer") navigate("/dashboard");
          else if (role === "distributor") navigate("/distributor-dashboard");
          else if (role === "productowner" || role === "product owner") navigate("/product-owner-dashboard");
          else navigate("/");
        } else {
          console.warn("No user profile found in Firestore.");
          navigate("/");
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
        navigate("/");
      } finally {
        setIsLoadingUser(false);
      }
    };

    if (type === "login") {
      checkUserRoleAndRedirect();
    } else {
      setIsLoadingUser(false);
    }
  }, [user, type]);

  if (isLoadingUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <p className="text-white text-lg animate-pulse">Loading...</p>
      </div>
    );
  }

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
      <>
        {type === "register" && !selectedRole && (
          <div className="flex w-full min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
            {/* Left Panel */}
            <div className="w-1/2 flex flex-col justify-center items-center bg-gradient-to-br from-yellow-100 to-yellow-200 text-black p-12">
              <h2 className="text-3xl font-bold mb-4 text-left w-full">Why Choose BusinessPilot?</h2>
              <p className="text-lg mb-8 text-left w-full">Empowering Indian Retailers, Distributors, and Product Owners with automated billing, smart inventory, and real-time supply chain dashboards.</p>
              <div className="text-sm italic text-left w-full">
                "With BusinessPilot, our order processing time dropped by 70%. Now I track my dealers, stock, and invoices in one place."
                <br />– Raghav, Distributor, Pune
              </div>
            </div>

            {/* Right Panel */}
            <div className="w-1/2 flex flex-col justify-center items-center p-10">
              <div className="bg-white text-black rounded-2xl shadow-xl p-10 w-full max-w-md animate-fadeIn">
                <h2 className="text-2xl font-bold mb-6 text-center">Select Your Role to Register</h2>
                <div className="space-y-4">
                  <div
                    onClick={() => handleRoleSelect("Retailer")}
                    className="cursor-pointer border-2 border-blue-400 hover:border-blue-500 bg-blue-50 hover:bg-blue-100 rounded-xl p-5 transition-all duration-300 hover:scale-[1.02]"
                  >
                    <h3 className="text-blue-700 font-semibold text-lg">Retailer</h3>
                    <p className="text-sm text-gray-600 mt-1">Manages product selling to end customers</p>
                  </div>
                  <div
                    onClick={() => handleRoleSelect("Distributor")}
                    className="cursor-pointer border-2 border-green-400 hover:border-green-500 bg-green-50 hover:bg-green-100 rounded-xl p-5 transition-all duration-300 hover:scale-[1.02]"
                  >
                    <h3 className="text-green-700 font-semibold text-lg">Distributor</h3>
                    <p className="text-sm text-gray-600 mt-1">Supplies inventory to retailers</p>
                  </div>
                  <div
                    onClick={() => handleRoleSelect("ProductOwner")}
                    className="cursor-pointer border-2 border-orange-400 hover:border-orange-500 bg-orange-50 hover:bg-orange-100 rounded-xl p-5 transition-all duration-300 hover:scale-[1.02]"
                  >
                    <h3 className="text-orange-700 font-semibold text-lg">Product Owner</h3>
                    <p className="text-sm text-gray-600 mt-1">Owns and distributes products to distributors</p>
                  </div>
                </div>
                <div className="flex justify-center mt-6">
                  <button
                    className="text-sm text-gray-600 hover:text-white hover:bg-red-500 px-4 py-2 rounded transition-all duration-300"
                    onClick={() => navigate("/")}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {type === "register" && selectedRole && (
          <div className="animate-fadeInUp transition-all duration-500">
            <Register role={selectedRole} />
          </div>
        )}

        {type === "login" && <Login />}
      </>
    </div>
  );
};

export default AuthPage;