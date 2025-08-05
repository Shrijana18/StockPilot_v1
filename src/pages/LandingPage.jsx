import React, { useEffect } from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AOS from 'aos';
import 'aos/dist/aos.css';
import Lottie from "lottie-react";

const LandingPage = () => {
  const navigate = useNavigate();

  const [animationData, setAnimationData] = useState(null);

  useEffect(() => {
    AOS.init({ duration: 1000 });

    fetch("/assets/supplyFlow.json")
      .then((res) => res.json())
      .then(setAnimationData)
      .catch(console.error);
  }, []);

  return (
    <div className="bg-white text-gray-900">
      {/* Navbar */}
      <header className="flex justify-between items-center p-6 shadow-md">
        <div className="flex items-center">
          <img src="/assets/flyp-logo.png" alt="FLYP Logo" className="h-28 w-auto drop-shadow-md" />
        </div>
        <nav className="hidden md:flex gap-6">
          <Link to="#features" className="hover:text-green-600">Features</Link>
          <Link to="#pricing" className="hover:text-green-600">Pricing</Link>
          <Link to="#contact" className="hover:text-green-600">Contact</Link>
        </nav>
        <div className="flex gap-4">
          <button
            className="bg-green-600 hover:bg-green-700 text-white py-1 px-4 rounded"
            onClick={() => navigate("/auth?type=login")}
          >
            Sign In
          </button>
          <button
            className="bg-yellow-500 hover:bg-yellow-600 text-white py-1 px-4 rounded"
            onClick={() => navigate("/auth?type=register")}
          >
            Register
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative flex flex-col-reverse md:flex-row items-center px-10 py-20 bg-gradient-to-r from-green-50 via-yellow-50 to-white overflow-hidden">

        {/* LEFT: Tagline + Subtext */}
        <div className="w-full md:w-1/2 text-center md:text-left z-10 space-y-6">
          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight">
            Stop running your business. <br />
            <span className="text-green-700">Start flying it.</span>
          </h1>
          
          <p className="text-lg text-gray-800 max-w-xl">
            <strong>Onboard your business in under 30 minutes.</strong><br />
            Built for real people. No manuals. No training. Just results.<br />
            Automate inventory, billing, and order flows — effortlessly.
          </p>

          <div className="mt-4">
            <Link to="/auth?type=register">
              <button className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded shadow-lg">
                Get Started Free
              </button>
            </Link>
          </div>
        </div>

        {/* RIGHT: Animation */}
        <div className="w-full md:w-1/2 flex justify-center z-10">
          {animationData && (
            <Lottie animationData={animationData} loop={true} className="w-96 h-96" />
          )}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 px-10 bg-white text-center">
        <h3 className="text-3xl font-bold mb-12">Core Features</h3>
        <div className="grid md:grid-cols-4 gap-10">
          <div data-aos="zoom-in">
            <img src="/assets/ai_inventory.png" alt="AI Inventory Generator" className="mx-auto mb-4 w-20 h-20 object-contain rounded" />
            <h4 className="font-semibold text-lg">AI Inventory Generator</h4>
            <p className="text-sm text-gray-600">Automatically generate and optimize your inventory with AI-driven insights.</p>
          </div>
          <div data-aos="zoom-in">
            <img src="/assets/ocr_billing.png" alt="OCR Billing Import" className="mx-auto mb-4 w-20 h-20 object-contain rounded" />
            <h4 className="font-semibold text-lg">OCR Billing Import</h4>
            <p className="text-sm text-gray-600">Scan and import paper invoices instantly with smart OCR technology.</p>
          </div>
          <div data-aos="zoom-in">
            <img src="/assets/smart_cart.png" alt="Smart Cart" className="mx-auto mb-4 w-20 h-20 object-contain rounded" />
            <h4 className="font-semibold text-lg">Smart Cart</h4>
            <p className="text-sm text-gray-600">Create and manage orders quickly with intelligent cart suggestions.</p>
          </div>
          <div data-aos="zoom-in">
            <img src="/assets/customer_analytics.png" alt="Customer Analytics" className="mx-auto mb-4 w-20 h-20 object-contain rounded" />
            <h4 className="font-semibold text-lg">Customer Analytics</h4>
            <p className="text-sm text-gray-600">Gain insights into customer behavior and sales trends.</p>
          </div>
          <div data-aos="zoom-in">
            <img src="/assets/distributor_connect.png" alt="Distributor Connect" className="mx-auto mb-4 w-20 h-20 object-contain rounded" />
            <h4 className="font-semibold text-lg">Distributor Connect</h4>
            <p className="text-sm text-gray-600">Seamlessly collaborate and sync inventory with your distributors.</p>
          </div>
          <div data-aos="zoom-in">
            <img src="/assets/dashboards_kpis.png" alt="Dashboards & KPIs" className="mx-auto mb-4 w-20 h-20 object-contain rounded" />
            <h4 className="font-semibold text-lg">Dashboards & KPIs</h4>
            <p className="text-sm text-gray-600">Track key performance indicators with customizable dashboards.</p>
          </div>
          <div data-aos="zoom-in">
            <img src="/assets/realtime_inventory.png" alt="Realtime Inventory Sync" className="mx-auto mb-4 w-20 h-20 object-contain rounded" />
            <h4 className="font-semibold text-lg">Realtime Inventory Sync</h4>
            <p className="text-sm text-gray-600">Keep your stock levels updated across all platforms instantly.</p>
          </div>
          <div data-aos="zoom-in">
            <img src="/assets/gemini_ai.png" alt="Gemini AI Assistant" className="mx-auto mb-4 w-20 h-20 object-contain rounded" />
            <h4 className="font-semibold text-lg">Gemini AI Assistant</h4>
            <p className="text-sm text-gray-600">Your AI assistant for smarter decision-making and automation.</p>
          </div>
        </div>
      </section>

      {/* Why FLYP */}
      <section id="whyflyp" className="py-20 px-10 bg-green-50 text-center">
        <h3 className="text-3xl font-bold mb-10">Why FLYP?</h3>
        <p className="text-lg text-gray-700 max-w-4xl mx-auto mb-6">
          FLYP is the only platform connecting Retailers, Distributors, and Product Owners with AI-powered inventory management, automated billing, performance analytics, and real-time collaboration.
        </p>
        <p className="text-lg text-gray-600 max-w-3xl mx-auto">
          Whether you’re tracking SKUs, scanning paper invoices, generating smart bills, or managing your full supply chain — FLYP adapts to your workflow and unlocks scale.
        </p>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-10 bg-gray-100 text-center">
        <h3 className="text-3xl font-bold mb-12">Pricing Plans</h3>
        <div className="grid md:grid-cols-4 gap-8">
          <div data-aos="flip-left" className="bg-white shadow-lg p-6 rounded border-l-4 border-green-600">
            <h4 className="text-xl font-bold mb-4">Check-In</h4>
            <p className="text-green-600 font-semibold text-2xl mb-6">Free</p>
            <div className="text-left text-sm text-gray-700 space-y-3 mb-6">
              <p><strong>Retailer:</strong> Basic inventory tracking & billing.</p>
              <p><strong>Distributor:</strong> Limited product sync.</p>
              <p><strong>Product Owner:</strong> Basic analytics dashboard.</p>
            </div>
            <button className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 w-full">Choose Plan</button>
          </div>
          <div data-aos="flip-left" className="bg-white shadow-lg p-6 rounded border-l-4 border-yellow-400">
            <h4 className="text-xl font-bold mb-4">Onboard</h4>
            <p className="text-yellow-600 font-semibold text-2xl mb-6">₹299/mo</p>
            <div className="text-left text-sm text-gray-700 space-y-3 mb-6">
              <p><strong>Retailer:</strong> Smart cart & OCR billing import.</p>
              <p><strong>Distributor:</strong> Inventory sync & order management.</p>
              <p><strong>Product Owner:</strong> Advanced analytics & AI inventory generator.</p>
            </div>
            <button className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 w-full">Choose Plan</button>
          </div>
          <div data-aos="flip-left" className="bg-white shadow-lg p-6 rounded border-l-4 border-blue-500">
            <h4 className="text-xl font-bold mb-4">Takeoff</h4>
            <p className="text-blue-600 font-semibold text-2xl mb-6">₹499/mo</p>
            <div className="text-left text-sm text-gray-700 space-y-3 mb-6">
              <p><strong>Retailer:</strong> Customer analytics & realtime inventory sync.</p>
              <p><strong>Distributor:</strong> Distributor connect & automated billing.</p>
              <p><strong>Product Owner:</strong> Dashboards & KPIs with Gemini AI assistant.</p>
            </div>
            <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full">Choose Plan</button>
          </div>
          <div data-aos="flip-left" className="bg-white shadow-lg p-6 rounded border-l-4 border-gray-800">
            <h4 className="text-xl font-bold mb-4">Fly</h4>
            <p className="text-gray-800 font-semibold text-2xl mb-6">Custom</p>
            <div className="text-left text-sm text-gray-700 space-y-3 mb-6">
              <p><strong>Retailer:</strong> Full feature access & priority support.</p>
              <p><strong>Distributor:</strong> Custom integrations & multi-branch management.</p>
              <p><strong>Product Owner:</strong> Dedicated AI support & enterprise analytics.</p>
            </div>
            <button className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900 w-full">Contact Us</button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-gray-900 text-white p-6 mt-10 text-center text-sm">
        <p>© {new Date().getFullYear()} FLYP — All Rights Reserved.</p>
        <p className="mt-1">Contact: support@flypnow.com</p>
      </footer>
    </div>
  );
};

export default LandingPage;