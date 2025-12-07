import React from 'react'

function HomePage() {
  return (
    <div className="px-4 py-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to PulseEngine
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          A robust edge tools platform with backend logic management
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-primary-600 text-3xl mb-4">🔧</div>
            <h3 className="text-lg font-semibold mb-2">Edge Tools</h3>
            <p className="text-gray-600">
              All tool logic managed securely in the backend
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-primary-600 text-3xl mb-4">🚀</div>
            <h3 className="text-lg font-semibold mb-2">Robust API</h3>
            <p className="text-gray-600">
              RESTful and GraphQL APIs with comprehensive management
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-primary-600 text-3xl mb-4">💾</div>
            <h3 className="text-lg font-semibold mb-2">Data Handling</h3>
            <p className="text-gray-600">
              PostgreSQL with real-time subscriptions via Supabase
            </p>
          </div>
        </div>

        <div className="mt-12 bg-primary-50 p-8 rounded-lg">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Architecture Highlights
          </h2>
          <div className="text-left max-w-2xl mx-auto">
            <ul className="space-y-2 text-gray-700">
              <li>✓ Frontend deployed on Netlify with automatic CI/CD</li>
              <li>✓ Backend powered by Supabase (PostgreSQL + Edge Functions)</li>
              <li>✓ Secure authentication with JWT tokens</li>
              <li>✓ Real-time data synchronization</li>
              <li>✓ Scalable plugin architecture for tools</li>
              <li>✓ Comprehensive error handling and logging</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage
