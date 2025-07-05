import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import AOS from 'aos';
import 'aos/dist/aos.css';

const LandingPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    AOS.init({ duration: 1000 });
  }, []);

  return (
    <div className="bg-white text-gray-900">
      {/* Navbar */}
      <header className="flex justify-between items-center p-6 shadow-md">
        <h1 className="text-2xl font-bold text-green-700">BusinessPilot</h1>
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
      <section data-aos="fade-up" className="relative flex flex-col-reverse md:flex-row items-center px-10 py-16 bg-gradient-to-r from-yellow-50 to-green-50 overflow-hidden">
        {/* Background Animation Layer */}
        <div className="absolute inset-0 opacity-10">
          <img src="https://cdn.pixabay.com/photo/2020/05/19/17/33/supply-chain-5199528_960_720.jpg" alt="Supply Chain Flow" className="w-full h-full object-cover" />
        </div>

        {/* Foreground Content */}
        <div className="relative z-10 md:w-1/2 text-center md:text-left">
          <h2 className="text-4xl font-bold mb-4">Stop Running Your Business<br />Start Flying It!</h2>
          <p className="mb-6 text-lg">
            One platform to manage inventory, billing, analytics, and customers — connecting <strong>Product Owners</strong>, <strong>Distributors</strong>, and <strong>Retailers</strong> through intelligent automation.
          </p>
          <div className="mb-4 text-base text-gray-700">
            <p className="mb-2">
              <strong>What is a Supply Chain?</strong> <br />
              A supply chain links <span className="text-green-700 font-semibold">Product Owners</span> (who make or supply goods), <span className="text-green-700 font-semibold">Distributors</span> (who move and store goods), and <span className="text-green-700 font-semibold">Retailers</span> (who sell to customers).
            </p>
            <ul className="list-disc ml-6 text-sm text-gray-600 space-y-1">
              <li><strong>Product Owners:</strong> Track stock, manage production, and analyze demand.</li>
              <li><strong>Distributors:</strong> Automate inventory sync and billing, reduce manual errors.</li>
              <li><strong>Retailers:</strong> Get real-time product info, simple billing, and customer insights.</li>
            </ul>
            <p className="mt-2">
              <span className="font-semibold text-green-600">BusinessPilot</span> lets every role collaborate and automate, making the entire supply chain seamless and efficient.
            </p>
          </div>
          <Link to="/auth?type=register">
            <button className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded">Get Started Free</button>
          </Link>
        </div>
        <div className="relative z-10 md:w-1/2 flex justify-center">
          <img
            src="https://cdn-icons-png.flaticon.com/512/2621/2621043.png"
            alt="Hero Visual"
            className="w-80 h-auto rounded-lg shadow-lg border border-gray-200"
          />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 px-10 bg-white text-center">
        <h3 className="text-3xl font-bold mb-12">Core Features</h3>
        <div className="grid md:grid-cols-3 gap-10">
          <div data-aos="zoom-in">
            <img src="/assets/analytics.png" alt="Smart Analytics" className="mx-auto mb-4 w-20 h-20 object-contain rounded" />
            <h4 className="font-semibold text-lg">Smart Analytics</h4>
            <p className="text-sm text-gray-600">Get real-time insights on sales, customers, and stock performance.</p>
          </div>
          <div data-aos="zoom-in">
            <img src="/assets/inventory.png" alt="Inventory Sync" className="mx-auto mb-4 w-20 h-20 object-contain rounded" />
            <h4 className="font-semibold text-lg">Inventory Sync</h4>
            <p className="text-sm text-gray-600">Automatically update stock levels and track product performance.</p>
          </div>
          <div data-aos="zoom-in">
            <img src="/assets/billing.png" alt="Intelligent Billing" className="mx-auto mb-4 w-20 h-20 object-contain rounded" />
            <h4 className="font-semibold text-lg">Intelligent Billing</h4>
            <p className="text-sm text-gray-600">Create invoices, apply discounts, and accept multiple payment modes.</p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-10 bg-gray-100 text-center">
        <h3 className="text-3xl font-bold mb-12">Pricing Plans</h3>
        <div className="grid md:grid-cols-3 gap-8">
          <div data-aos="flip-left" className="bg-white shadow-lg p-6 rounded">
            <h4 className="text-xl font-bold mb-2">Starter</h4>
            <p className="text-green-600 font-semibold text-2xl mb-4">Free</p>
            <ul className="text-sm text-gray-600 mb-6 space-y-1">
              <li>Up to 50 Products</li>
              <li>Basic Billing Module</li>
              <li>Email Support</li>
            </ul>
            <button className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Choose Plan</button>
          </div>
          <div data-aos="flip-left" className="bg-white shadow-lg p-6 rounded border-2 border-yellow-400">
            <h4 className="text-xl font-bold mb-2">Pro</h4>
            <p className="text-yellow-600 font-semibold text-2xl mb-4">₹499/mo</p>
            <ul className="text-sm text-gray-600 mb-6 space-y-1">
              <li>Unlimited Products</li>
              <li>Inventory + Billing</li>
              <li>WhatsApp Support</li>
            </ul>
            <button className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600">Choose Plan</button>
          </div>
          <div data-aos="flip-left" className="bg-white shadow-lg p-6 rounded">
            <h4 className="text-xl font-bold mb-2">Enterprise</h4>
            <p className="text-gray-800 font-semibold text-2xl mb-4">Custom</p>
            <ul className="text-sm text-gray-600 mb-6 space-y-1">
              <li>Custom Integrations</li>
              <li>Multiple Branches</li>
              <li>Priority Support</li>
            </ul>
            <button className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900">Contact Us</button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-gray-900 text-white p-6 mt-10 text-center text-sm">
        <p>© {new Date().getFullYear()} BusinessPilot — All Rights Reserved.</p>
        <p className="mt-1">Contact: support@businesspilot.in</p>
      </footer>
    </div>
  );
};

export default LandingPage;