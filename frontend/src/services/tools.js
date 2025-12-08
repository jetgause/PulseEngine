import apiClient from './api'

/**
 * Tool Service - Handles all tool-related API calls
 */
export const toolService = {
  /**
   * Get all available tools
   * @param {Object} params - Query parameters (page, limit, category, etc.)
   * @returns {Promise<Object>} Tools list with pagination
   */
  async getTools(params = {}) {
    return apiClient.get('/tools', { params })
  },

  /**
   * Get a specific tool by ID
   * @param {string} toolId - Tool identifier
   * @returns {Promise<Object>} Tool details
   */
  async getTool(toolId) {
    return apiClient.get(`/tools/${toolId}`)
  },

  /**
   * Execute a tool with given parameters
   * @param {string} toolId - Tool identifier
   * @param {Object} parameters - Tool execution parameters
   * @returns {Promise<Object>} Execution result
   */
  async executeTool(toolId, parameters = {}) {
    return apiClient.post(`/tools/${toolId}/execute`, parameters)
  },

  /**
   * Get tool execution history
   * @param {string} toolId - Tool identifier
   * @param {Object} params - Query parameters (page, limit, etc.)
   * @returns {Promise<Object>} Execution history
   */
  async getToolHistory(toolId, params = {}) {
    return apiClient.get(`/tools/${toolId}/history`, { params })
  },

  /**
   * Get tool execution status
   * @param {string} executionId - Execution identifier
   * @returns {Promise<Object>} Execution status
   */
  async getExecutionStatus(executionId) {
    return apiClient.get(`/executions/${executionId}`)
  },

  /**
   * Cancel a running tool execution
   * @param {string} executionId - Execution identifier
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelExecution(executionId) {
    return apiClient.post(`/executions/${executionId}/cancel`)
  },

  /**
   * Get tool categories
   * @returns {Promise<Array>} List of tool categories
   */
  async getCategories() {
    return apiClient.get('/tools/categories')
  },

  /**
   * Search tools
   * @param {string} query - Search query
   * @param {Object} filters - Search filters
   * @returns {Promise<Object>} Search results
   */
  async searchTools(query, filters = {}) {
    return apiClient.get('/tools/search', {
      params: { q: query, ...filters },
    })
  },
}

export default toolService
