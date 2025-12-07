import apiClient from './api'

/**
 * Data Service - Generic data handling service
 */
export const dataService = {
  /**
   * Get resources from a collection
   * @param {string} resource - Resource name (e.g., 'users', 'projects')
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Resources list
   */
  async getAll(resource, params = {}) {
    return apiClient.get(`/data/${resource}`, { params })
  },

  /**
   * Get a single resource by ID
   * @param {string} resource - Resource name
   * @param {string} id - Resource ID
   * @returns {Promise<Object>} Resource details
   */
  async getById(resource, id) {
    return apiClient.get(`/data/${resource}/${id}`)
  },

  /**
   * Create a new resource
   * @param {string} resource - Resource name
   * @param {Object} data - Resource data
   * @returns {Promise<Object>} Created resource
   */
  async create(resource, data) {
    return apiClient.post(`/data/${resource}`, data)
  },

  /**
   * Update an existing resource
   * @param {string} resource - Resource name
   * @param {string} id - Resource ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>} Updated resource
   */
  async update(resource, id, data) {
    return apiClient.put(`/data/${resource}/${id}`, data)
  },

  /**
   * Partially update a resource
   * @param {string} resource - Resource name
   * @param {string} id - Resource ID
   * @param {Object} data - Partial data
   * @returns {Promise<Object>} Updated resource
   */
  async patch(resource, id, data) {
    return apiClient.patch(`/data/${resource}/${id}`, data)
  },

  /**
   * Delete a resource
   * @param {string} resource - Resource name
   * @param {string} id - Resource ID
   * @returns {Promise<void>}
   */
  async delete(resource, id) {
    return apiClient.delete(`/data/${resource}/${id}`)
  },

  /**
   * Bulk operations
   * @param {string} resource - Resource name
   * @param {Array} operations - Array of operations
   * @returns {Promise<Object>} Bulk operation result
   */
  async bulkOperation(resource, operations) {
    return apiClient.post(`/data/${resource}/bulk`, { operations })
  },
}

export default dataService
