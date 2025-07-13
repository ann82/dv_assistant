import { config } from './config.js';
import logger from './logger.js';
import { OpenAIIntegration } from '../integrations/openaiIntegration.js';

const openAIIntegration = new OpenAIIntegration();

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} vecA - First vector
 * @param {number[]} vecB - Second vector
 * @returns {number} Cosine similarity score between -1 and 1
 */
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Get embedding for a text using OpenAI's text-embedding-3-small model
 * @param {string} text - Text to get embedding for
 * @returns {Promise<number[]>} Embedding vector
 */
async function getEmbedding(text) {
  try {
    const embedding = await openAIIntegration.createEmbedding({
      text,
      model: 'text-embedding-3-small',
      encodingFormat: 'float'
    });

    return embedding;
  } catch (error) {
    logger.error('Error getting embedding:', error);
    throw error;
  }
}

/**
 * Rerank Tavily search results by semantic relevance to the query
 * @param {string} query - User's search query
 * @param {TavilyResult[]} results - Array of Tavily search results
 * @returns {Promise<TavilyResult[]>} Reranked results sorted by relevance
 */
export async function rerankByRelevance(query, results) {
  try {
    // Only process top 5 results for efficiency
    const topResults = results.slice(0, 5);
    
    // Get query embedding
    const queryEmbedding = await getEmbedding(query);
    
    // Score each result
    const scoredResults = await Promise.all(
      topResults.map(async (result) => {
        // Combine title and summary for better context
        const resultText = `${result.title} ${result.summary}`;
        const resultEmbedding = await getEmbedding(resultText);
        
        // Calculate similarity score
        const similarity = cosineSimilarity(queryEmbedding, resultEmbedding);
        
        return {
          ...result,
          relevanceScore: similarity
        };
      })
    );

    // Sort by relevance score in descending order
    const rerankedResults = scoredResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    logger.info('Results reranked by relevance:', {
      query,
      resultCount: rerankedResults.length,
      topScore: rerankedResults[0]?.relevanceScore
    });

    return rerankedResults;
  } catch (error) {
    logger.error('Error reranking results:', error);
    // Return original results if reranking fails
    return results;
  }
} 