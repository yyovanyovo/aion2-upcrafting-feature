import type {
  Server,
  MarketItem,
  Listing,
  DragonRecipe,
  NpcPrices
} from '~/types/dragon'

const BASE_TRPC_URL = 'https://questlog.gg/aion-2/api/trpc'

export const isMockMode = (): boolean => {
  return import.meta.env.VITE_USE_MOCK !== 'false'
}

function unwrapTrpcData<T>(raw: any): T {
  if (raw && typeof raw === 'object' && 'result' in raw && raw.result?.data !== undefined) {
    const data = raw.result.data
    return (data && typeof data === 'object' && 'json' in data ? data.json : data) as T
  }
  return raw as T
}

export async function fetchTrpc<T>(procedure: string, input?: unknown): Promise<T> {
  const url =
    input !== undefined
      ? `${BASE_TRPC_URL}/${procedure}?input=${encodeURIComponent(JSON.stringify(input))}`
      : `${BASE_TRPC_URL}/${procedure}`

  const response = await fetch(url, {
    headers: { Accept: 'application/json' }
  })

  if (!response.ok) {
    throw new Error(`tRPC request failed (${procedure}): ${response.status}`)
  }

  const json = await response.json()
  return unwrapTrpcData<T>(json)
}

export const apiService = {
  async getServers(): Promise<Server[]> {
    if (isMockMode()) {
      const raw = await $fetch<any>('/mock-api/servers.json')
      return unwrapTrpcData<Server[]>(raw)
    }
    return fetchTrpc<Server[]>('auctionHouse.getServers')
  },

  async getItems(params: Record<string, any> = { language: 'en' }): Promise<MarketItem[]> {
    if (isMockMode()) {
      const raw = await $fetch<any>('/mock-api/items.json')
      return unwrapTrpcData<MarketItem[]>(raw)
    }
    return fetchTrpc<MarketItem[]>('auctionHouse.getItems', params)
  },

  async getListings(params?: { serverId?: number; region?: string; itemIds?: number[] }): Promise<Listing[]> {
    if (isMockMode()) {
      const raw = await $fetch<any>('/mock-api/listings.json')
      return unwrapTrpcData<Listing[]>(raw)
    }
    return fetchTrpc<Listing[]>('auctionHouse.getListings', params)
  },

  async getRecipes(params: Record<string, any> = { language: 'en' }): Promise<DragonRecipe[]> {
    let rawData: Record<string, DragonRecipe> | DragonRecipe[]
    if (isMockMode()) {
      const raw = await $fetch<any>('/mock-api/recipes.json')
      rawData = unwrapTrpcData<Record<string, DragonRecipe> | DragonRecipe[]>(raw)
    } else {
      rawData = await fetchTrpc<Record<string, DragonRecipe> | DragonRecipe[]>('crafting.getRecipeData', params)
    }
    return Array.isArray(rawData) ? rawData : Object.values(rawData)
  },

  async getNpcPrices(): Promise<NpcPrices> {
    if (isMockMode()) {
      const raw = await $fetch<any>('/mock-api/npcPrices.json')
      return unwrapTrpcData<NpcPrices>(raw)
    }
    return fetchTrpc<NpcPrices>('crafting.getNpcPrices')
  }
}

export default apiService
