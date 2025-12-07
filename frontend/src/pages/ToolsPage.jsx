import React, { useEffect, useState } from 'react'
import { toolService } from '@/services/tools'

function ToolsPage() {
  const [tools, setTools] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadTools()
  }, [])

  const loadTools = async () => {
    try {
      setLoading(true)
      const data = await toolService.getTools()
      setTools(data.tools || [])
      setError(null)
    } catch (err) {
      setError(err.message || 'Failed to load tools')
      console.error('Error loading tools:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Loading tools...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        <p className="font-semibold">Error loading tools</p>
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Available Tools
        </h1>
        <p className="text-gray-600">
          Browse and execute tools managed by the backend
        </p>
      </div>

      {tools.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600">
            No tools available yet. Tools will appear here once configured in the backend.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool) => (
            <div
              key={tool.id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {tool.name}
              </h3>
              <p className="text-gray-600 text-sm mb-4">
                {tool.description}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  v{tool.version}
                </span>
                <button className="bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700 text-sm">
                  Execute
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ToolsPage
