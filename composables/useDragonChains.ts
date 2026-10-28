import { ref, shallowRef, computed } from 'vue'
import {
  DRAGON_STAGE_PREFIXES,
  type DragonRace,
  type DragonStageNumber,
  type DragonProfessionCategory,
  type DragonEquipmentCategory,
  type DragonCategoryFilter,
  type DragonRecipe,
  type DragonStageRecipe,
  type DragonSlotChain,
  type DragonChainsTree,
  type Server,
  type MarketItem,
  type Listing,
  type NpcPrices
} from '~/types/dragon'
import { apiService } from '~/services/api'

const STAGE_MATCH_ORDER: DragonStageNumber[] = [2, 4, 6, 1, 3, 5]

export function formatIconUrl(rawIcon?: string | null): string {
  if (!rawIcon) return ''
  if (rawIcon.startsWith('http://') || rawIcon.startsWith('https://')) return rawIcon
  const cleanPath = rawIcon.replace(/\.[^./]+$/, '') + '.webp'
  const normalizedPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`
  return `https://cdn.questlog.gg/aion-2${normalizedPath}`
}

export const REGION_LABELS: Record<string, string> = {
  nae: 'NA East',
  naw: 'NA West',
  eu: 'Europe',
  la: 'Latin America',
  as: 'Asia'
}

export function formatRegionName(region?: string): string {
  if (!region) return 'Global'
  const key = region.toLowerCase()
  return REGION_LABELS[key] || region.toUpperCase()
}

export function normalizeMainCategory(rawCategory?: string): DragonProfessionCategory {
  const cat = (rawCategory || '').toLowerCase()
  if (cat === 'tailoring' || cat === 'armorsmithing') return 'armorsmithing'
  if (cat === 'jewelcrafting' || cat === 'handicrafting') return 'handicrafting'
  if (cat === 'alchemy') return 'alchemy'
  return 'blacksmithing'
}

export function resolveEquipmentCategory(
  recipe?: DragonRecipe,
  slotName?: string
): DragonEquipmentCategory {
  const prodCat = (recipe?.recipeOutputItems?.productItem?.mainCategory || '').toLowerCase()
  if (prodCat === 'weapon' || prodCat === 'armor' || prodCat === 'accessory') {
    return prodCat
  }
  const slot = (slotName || '').toLowerCase()
  if (slot === 'necklace' || slot === 'earrings' || slot === 'ring') {
    return 'accessory'
  }
  if (
    slot === 'breastplate' ||
    slot === 'greaves' ||
    slot === 'helm' ||
    slot === 'pauldrons' ||
    slot === 'gloves' ||
    slot === 'boots' ||
    slot === 'cloak'
  ) {
    return 'armor'
  }
  return 'weapon'
}

export function parseDragonStage(
  name: string,
  race: DragonRace
): {
  stage: DragonStageNumber
  prefix: string
  slot: string
  isSplendent: boolean
} | null {
  const prefixes = DRAGON_STAGE_PREFIXES[race]
  if (!prefixes || !name) return null

  for (const stageNum of STAGE_MATCH_ORDER) {
    const prefix = prefixes[stageNum]
    if (name.startsWith(prefix)) {
      const slot = name.slice(prefix.length).trim()
      if (slot) {
        return {
          stage: stageNum,
          prefix,
          slot,
          isSplendent: stageNum % 2 === 0
        }
      }
    }
  }

  return null
}

export function buildDragonChains(allRecipes: DragonRecipe[]): {
  chainsList: DragonSlotChain[]
  chainsTree: DragonChainsTree
  chainsByRaceAndSlot: Record<DragonRace, Record<string, DragonSlotChain>>
} {
  const dragonRecipes = allRecipes.filter(
    (r) =>
      r &&
      typeof r.name === 'string' &&
      r.name.includes('Dragon Lord') &&
      r.learnType === 'auto' &&
      Array.isArray(r.recipeInputItems) &&
      r.recipeInputItems.length > 0 &&
      (r.qualificationRace === 'light' || r.qualificationRace === 'dark')
  )

  const chainMap = new Map<
    string,
    {
      slot: string
      race: DragonRace
      mainCategory: DragonProfessionCategory
      rawMainCategory: string
      subCategory: string
      subTab: string
      stages: Partial<Record<DragonStageNumber, DragonStageRecipe>>
    }
  >()

  for (const recipe of dragonRecipes) {
    const race = recipe.qualificationRace as DragonRace
    const parsed = parseDragonStage(recipe.name, race)
    if (!parsed) continue

    const { stage, prefix, slot, isSplendent } = parsed
    const chainKey = `${race}:${slot}`
    const normCategory = normalizeMainCategory(recipe.mainCategory)
    const comboProb = recipe.recipeOutputItems?.comboProbability ?? null

    const stageRecipe: DragonStageRecipe = {
      ...recipe,
      stage,
      prefix,
      slot,
      isSplendent,
      comboProbability: comboProb,
      procRate: comboProb ? comboProb / 10000 : 1,
      recipe
    }

    let entry = chainMap.get(chainKey)
    if (!entry) {
      entry = {
        slot,
        race,
        mainCategory: normCategory,
        rawMainCategory: recipe.mainCategory,
        subCategory: recipe.subCategory || '',
        subTab: recipe.subTab || slot,
        stages: {}
      }
      chainMap.set(chainKey, entry)
    }

    if (recipe.subCategory && !entry.subCategory) {
      entry.subCategory = recipe.subCategory
    }
    if (recipe.subTab && (!entry.subTab || stage === 1)) {
      entry.subTab = recipe.subTab
    }

    entry.stages[stage] = stageRecipe
  }

  const chainsList: DragonSlotChain[] = []
  const chainsTree: DragonChainsTree = { light: {}, dark: {} }
  const chainsByRaceAndSlot: Record<DragonRace, Record<string, DragonSlotChain>> = {
    light: {},
    dark: {}
  }

  for (const [key, entry] of chainMap.entries()) {
    const stage1 = entry.stages[1]
    const orderedStages = {} as Record<DragonStageNumber, DragonStageRecipe>

    for (const s of [1, 2, 3, 4, 5, 6] as DragonStageNumber[]) {
      const st = entry.stages[s]
      if (st) {
        if (stage1 && st.masteryLevel === undefined) {
          st.masteryLevel = stage1.masteryLevel
        }
        if (stage1 && st.masteryGrade === undefined) {
          st.masteryGrade = stage1.masteryGrade
        }
        orderedStages[s] = st
      }
    }

    if (
      orderedStages[1] &&
      orderedStages[2] &&
      orderedStages[3] &&
      orderedStages[4] &&
      orderedStages[5] &&
      orderedStages[6]
    ) {
      const completeChain: DragonSlotChain = {
        key,
        slot: entry.slot,
        race: entry.race,
        factionName: entry.race === 'light' ? 'Elyos' : 'Asmodian',
        equipmentCategory: resolveEquipmentCategory(orderedStages[1], entry.slot),
        mainCategory: entry.mainCategory,
        rawMainCategory: entry.rawMainCategory,
        subCategory: entry.subCategory,
        subTab: entry.subTab,
        stages: {
          1: orderedStages[1],
          2: orderedStages[2],
          3: orderedStages[3],
          4: orderedStages[4],
          5: orderedStages[5],
          6: orderedStages[6]
        }
      }

      chainsList.push(completeChain)
      chainsByRaceAndSlot[entry.race][entry.slot] = completeChain

      if (!chainsTree[entry.race][entry.mainCategory]) {
        chainsTree[entry.race][entry.mainCategory] = {}
      }
      if (!chainsTree[entry.race][entry.mainCategory][entry.subTab]) {
        chainsTree[entry.race][entry.mainCategory][entry.subTab] = {}
      }
      chainsTree[entry.race][entry.mainCategory][entry.subTab][entry.slot] = completeChain

      if (entry.rawMainCategory !== entry.mainCategory) {
        if (!chainsTree[entry.race][entry.rawMainCategory]) {
          chainsTree[entry.race][entry.rawMainCategory] =
            chainsTree[entry.race][entry.mainCategory]
        }
      }
    }
  }

  return {
    chainsList,
    chainsTree,
    chainsByRaceAndSlot
  }
}

const isLoading = ref(false)
const isLoaded = ref(false)
const error = ref<string | null>(null)

const allRecipes = shallowRef<DragonRecipe[]>([])
const items = shallowRef<MarketItem[]>([])
const listings = shallowRef<Listing[]>([])
const npcPrices = shallowRef<NpcPrices>({})
const servers = shallowRef<Server[]>([])

const selectedServerId = ref<number>(2304)
const selectedRace = ref<DragonRace>('light')
const selectedCategory = ref<DragonCategoryFilter>('all')
const selectedSubTab = ref<string>('Sword')
const selectedSlot = ref<string>('Longsword')

let loadPromise: Promise<void> | null = null

export const useDragonChains = () => {
  const loadDragonData = async () => {
    if (isLoaded.value) return
    if (loadPromise) return loadPromise

    isLoading.value = true
    error.value = null

    loadPromise = (async () => {
      try {
        const [loadedRecipes, loadedItems, loadedListings, loadedNpc, loadedServers] =
          await Promise.all([
            apiService.getRecipes(),
            apiService.getItems(),
            apiService.getListings({ serverId: selectedServerId.value }),
            apiService.getNpcPrices(),
            apiService.getServers()
          ])

        allRecipes.value = loadedRecipes || []
        items.value = loadedItems || []
        listings.value = loadedListings || []
        npcPrices.value = loadedNpc || {}
        servers.value = loadedServers || []

        if (servers.value.length > 0 && !servers.value.some((s) => s.serverId === selectedServerId.value)) {
          const lumielEu = servers.value.find(
            (s) => s.name.toLowerCase().includes('lumiel') && s.region === 'eu'
          )
          const lumielAny = servers.value.find((s) => s.name.toLowerCase().includes('lumiel'))
          selectedServerId.value = lumielEu
            ? lumielEu.serverId
            : lumielAny
              ? lumielAny.serverId
              : servers.value[0].serverId
        }

        isLoaded.value = true
      } catch (err: any) {
        console.error('Failed to load Dragon Lord calculator data:', err)
        error.value = err?.message || 'Failed to load data'
      } finally {
        isLoading.value = false
        loadPromise = null
      }
    })()

    return loadPromise
  }

  const changeServer = async (serverId: number) => {
    selectedServerId.value = Number(serverId)
    const srv = servers.value.find((s) => s.serverId === Number(serverId))
    try {
      const updatedListings = await apiService.getListings({
        serverId: Number(serverId),
        region: srv?.region
      })
      if (updatedListings) {
        listings.value = updatedListings
      }
    } catch (err) {
      console.error('Failed to refresh market listings:', err)
    }
  }

  if (typeof window !== 'undefined' && !isLoaded.value && !isLoading.value) {
    loadDragonData()
  }

  const serversByRegion = computed(() => {
    const groups: { region: string; label: string; servers: Server[] }[] = []
    const map = new Map<string, Server[]>()
    for (const s of servers.value) {
      const reg = (s.region || 'global').toLowerCase()
      if (!map.has(reg)) map.set(reg, [])
      map.get(reg)!.push(s)
    }
    for (const [region, list] of map.entries()) {
      groups.push({
        region,
        label: formatRegionName(region),
        servers: list
      })
    }
    return groups
  })

  const activeServer = computed<Server | null>(() => {
    return servers.value.find((s) => s.serverId === selectedServerId.value) ?? servers.value[0] ?? null
  })

  const parsedChains = computed(() => buildDragonChains(allRecipes.value))
  const chainsList = computed(() => parsedChains.value.chainsList)
  const chainsTree = computed(() => parsedChains.value.chainsTree)
  const chainsByRaceAndSlot = computed(() => parsedChains.value.chainsByRaceAndSlot)

  const allRecipesById = computed(() => {
    const map = new Map<string, DragonRecipe>()
    for (const r of allRecipes.value) {
      map.set(String(r.id), r)
    }
    return map
  })

  const itemProducerRecipeMap = computed(() => {
    const map = new Map<number, DragonRecipe>()
    for (const r of allRecipes.value) {
      const prodId = Number(r.recipeOutputItems?.productItem?.id)
      if (prodId && r.learnType === 'auto' && !map.has(prodId)) {
        map.set(prodId, r)
      }
    }
    return map
  })

  const itemsMap = computed(() => {
    const map = new Map<number, MarketItem>()
    for (const item of items.value) {
      map.set(Number(item.id), item)
    }
    return map
  })

  const listingsMap = computed(() => {
    const map = new Map<number, Listing>()
    for (const listing of listings.value) {
      map.set(Number(listing.itemId), listing)
    }
    return map
  })

  const getChainsForFaction = (race: DragonRace = selectedRace.value): DragonSlotChain[] => {
    return chainsList.value.filter((c) => c.race === race)
  }

  const getChainsByCategory = (
    race: DragonRace = selectedRace.value,
    category: DragonCategoryFilter | string = selectedCategory.value
  ): DragonSlotChain[] => {
    if (!category || category === 'all') {
      return getChainsForFaction(race)
    }
    const lower = category.toLowerCase()
    if (lower === 'weapon' || lower === 'armor' || lower === 'accessory') {
      return chainsList.value.filter((c) => c.race === race && c.equipmentCategory === lower)
    }
    const normCat = normalizeMainCategory(category)
    return chainsList.value.filter((c) => c.race === race && c.mainCategory === normCat)
  }

  const filteredChains = computed<DragonSlotChain[]>(() => {
    return getChainsByCategory(selectedRace.value, selectedCategory.value)
  })

  const chainsByEquipmentCategory = computed<Record<DragonEquipmentCategory, DragonSlotChain[]>>(() => {
    const groups: Record<DragonEquipmentCategory, DragonSlotChain[]> = {
      weapon: [],
      armor: [],
      accessory: []
    }
    for (const c of filteredChains.value) {
      groups[c.equipmentCategory].push(c)
    }
    return groups
  })

  const categoryCounts = computed<Record<DragonCategoryFilter, number>>(() => {
    const factionChains = getChainsForFaction(selectedRace.value)
    const counts: Record<DragonCategoryFilter, number> = {
      all: factionChains.length,
      weapon: 0,
      armor: 0,
      accessory: 0,
      blacksmithing: 0,
      armorsmithing: 0,
      handicrafting: 0,
      alchemy: 0
    }
    for (const c of factionChains) {
      counts[c.equipmentCategory] = (counts[c.equipmentCategory] || 0) + 1
      counts[c.mainCategory] = (counts[c.mainCategory] || 0) + 1
    }
    return counts
  })

  const getAvailableSubTabs = (
    race: DragonRace = selectedRace.value,
    category: DragonCategoryFilter | string = selectedCategory.value
  ): string[] => {
    if (!category || category === 'all') {
      const factionChains = getChainsForFaction(race)
      return [...new Set(factionChains.map((c) => c.subTab))]
    }
    const catTree = chainsTree.value[race]?.[normalizeMainCategory(category)]
    return catTree ? Object.keys(catTree) : []
  }

  const getAvailableSlots = (
    race: DragonRace = selectedRace.value,
    category?: DragonCategoryFilter | string,
    subTab?: string
  ): string[] => {
    let filtered = chainsList.value.filter((c) => c.race === race)
    if (category && category !== 'all') {
      const normCat = normalizeMainCategory(category)
      filtered = filtered.filter((c) => c.mainCategory === normCat)
    }
    if (subTab) {
      filtered = filtered.filter((c) => c.subTab === subTab)
    }
    return filtered.map((c) => c.slot)
  }

  const getChain = (
    race: DragonRace = selectedRace.value,
    slot: string = selectedSlot.value
  ): DragonSlotChain | null => {
    return chainsByRaceAndSlot.value[race]?.[slot] ?? null
  }

  const selectCategory = (category: DragonCategoryFilter) => {
    selectedCategory.value = category
    const matching = getChainsByCategory(selectedRace.value, category)
    if (matching.length > 0 && !matching.some((c) => c.slot === selectedSlot.value)) {
      selectedSlot.value = matching[0].slot
      selectedSubTab.value = matching[0].subTab
    }
  }

  const selectSlot = (slot: string) => {
    selectedSlot.value = slot
    const chain = getChain(selectedRace.value, slot)
    if (chain) {
      selectedSubTab.value = chain.subTab
    }
  }

  const activeChain = computed<DragonSlotChain | null>(() => {
    return getChain(selectedRace.value, selectedSlot.value)
  })

  return {
    isLoading,
    isLoaded,
    error,
    loadDragonData,
    changeServer,
    allRecipes,
    allRecipesById,
    itemProducerRecipeMap,
    items,
    itemsMap,
    listings,
    listingsMap,
    npcPrices,
    servers,
    serversByRegion,
    activeServer,
    selectedServerId,
    selectedRace,
    selectedCategory,
    selectedSubTab,
    selectedSlot,
    selectCategory,
    selectSlot,
    chainsList,
    chainsTree,
    chainsByRaceAndSlot,
    filteredChains,
    chainsByEquipmentCategory,
    categoryCounts,
    activeChain,
    getChainsForFaction,
    getChainsByCategory,
    getAvailableSubTabs,
    getAvailableSlots,
    getChain,
    formatIconUrl,
    formatRegionName
  }
}
