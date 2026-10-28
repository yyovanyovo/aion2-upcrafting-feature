<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useDragonChains, formatIconUrl, formatRegionName } from '~/composables/useDragonChains'
import { useTransferCalculator } from '~/composables/useTransferCalculator'
import type { DragonCategoryFilter, DragonEquipmentCategory, Server } from '~/types/dragon'

const {
  serversByRegion,
  activeServer,
  selectedServerId,
  selectedCategory,
  selectedSlot,
  chainsByEquipmentCategory,
  categoryCounts,
  changeServer,
  selectCategory,
  selectSlot
} = useDragonChains()

const { targetStage } = useTransferCalculator()

const categories: { id: DragonCategoryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'weapon', label: 'Weapons' },
  { id: 'armor', label: 'Armor' },
  { id: 'accessory', label: 'Accessories' }
]

const equipmentGroups = computed(() => {
  const sections: { key: DragonEquipmentCategory; label: string; items: any[] }[] = [
    { key: 'weapon', label: 'Weapons', items: chainsByEquipmentCategory.value.weapon },
    { key: 'armor', label: 'Armor', items: chainsByEquipmentCategory.value.armor },
    { key: 'accessory', label: 'Accessories', items: chainsByEquipmentCategory.value.accessory }
  ]
  return sections.filter((s) => s.items.length > 0)
})

const brokenIcons = ref<Record<string, boolean>>({})

const isServerMenuOpen = ref(false)
const activeRegionTab = ref<string>('eu')
const serverDropdownRef = ref<HTMLElement | null>(null)

watch(
  () => activeServer.value?.region,
  (newRegion) => {
    if (newRegion) {
      activeRegionTab.value = newRegion.toLowerCase()
    }
  },
  { immediate: true }
)

const toggleServerMenu = () => {
  if (!isServerMenuOpen.value && activeServer.value?.region) {
    activeRegionTab.value = activeServer.value.region.toLowerCase()
  }
  isServerMenuOpen.value = !isServerMenuOpen.value
}

const selectServer = (serverId: number) => {
  changeServer(serverId)
  isServerMenuOpen.value = false
}

const currentRegionServers = computed<Server[]>(() => {
  const group = serversByRegion.value.find((g) => g.region === activeRegionTab.value)
  return group ? group.servers : []
})

const splitIntoTwoColumns = (list: Server[]): [Server[], Server[]] => {
  const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name))
  const mid = Math.ceil(sorted.length / 2)
  return [sorted.slice(0, mid), sorted.slice(mid)]
}

const elyosColumns = computed<[Server[], Server[]]>(() => {
  return splitIntoTwoColumns(currentRegionServers.value.filter((s) => s.race === 1))
})

const asmodianColumns = computed<[Server[], Server[]]>(() => {
  return splitIntoTwoColumns(currentRegionServers.value.filter((s) => s.race === 2))
})

const handleClickOutside = (event: MouseEvent) => {
  if (!isServerMenuOpen.value) return
  const el = serverDropdownRef.value
  if (el && !el.contains(event.target as Node)) {
    isServerMenuOpen.value = false
  }
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && isServerMenuOpen.value) {
    isServerMenuOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
  document.addEventListener('keydown', handleKeyDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleClickOutside)
  document.removeEventListener('keydown', handleKeyDown)
})

const getSlotIcon = (chain: any): string => {
  const stageIcon =
    chain?.stages?.[targetStage.value]?.icon ||
    chain?.stages?.[6]?.icon ||
    chain?.stages?.[1]?.icon
  return formatIconUrl(stageIcon)
}
</script>

<template>
  <header class="mb-4 space-y-3">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <h1 class="text-[26px] font-bold tracking-tight text-white leading-tight">
        Aion 2 Transfer Crafting
      </h1>

      <div ref="serverDropdownRef" class="relative self-start sm:self-auto shrink-0">
        <button
          type="button"
          class="inline-flex items-center bg-[#151820] hover:bg-[#1a1e28] border border-[#252934] rounded-md px-3 py-1.5 transition-colors cursor-pointer"
          @click="toggleServerMenu"
        >
          <span
            class="w-1.5 h-1.5 rounded-full mr-2 shrink-0"
            :class="activeServer?.race === 1 ? 'bg-[#eab308]' : 'bg-[#a855f7]'"
          />
          <div class="flex items-baseline text-[12px] pr-4">
            <span class="font-semibold text-white">
              {{ activeServer?.name || 'Lumiel' }}
            </span>
            <span class="text-[#7a818e] ml-1">
              {{ formatRegionName(activeServer?.region) }}
            </span>
          </div>
          <svg
            class="w-3 h-3 text-[#7a818e] absolute right-2.5 pointer-events-none transition-transform"
            :class="{ 'rotate-180': isServerMenuOpen }"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <div
          v-if="isServerMenuOpen"
          class="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 z-50 w-[92vw] max-w-[660px] bg-[#16181d] border border-[#262932] rounded-lg shadow-2xl flex flex-col md:flex-row overflow-hidden"
        >
          <!-- Left Region Sidebar -->
          <div class="w-full md:w-[156px] shrink-0 p-2.5 border-b md:border-b-0 md:border-r border-[#23262f] flex md:flex-col gap-1 overflow-x-auto bg-[#16181d]">
            <button
              v-for="group in serversByRegion"
              :key="group.region"
              type="button"
              class="px-3 py-2 rounded-md text-left text-[13px] whitespace-nowrap transition-colors"
              :class="
                activeRegionTab === group.region
                  ? 'bg-[#262930] text-white font-semibold'
                  : 'text-[#d1d5db] hover:bg-[#1e2128] hover:text-white'
              "
              @click="activeRegionTab = group.region"
            >
              {{ group.label }}
            </button>
          </div>

          <!-- Right Faction Columns (Elyos & Asmodian) -->
          <div class="flex-1 p-4 grid grid-cols-1 sm:grid-cols-2 gap-6 bg-[#16181d]">
            <!-- Elyos Column -->
            <div>
              <div class="flex items-center gap-1.5 text-[12px] text-[#8b92a0] pb-2 mb-2 border-b border-[#252830]">
                <svg class="w-3.5 h-3.5 text-[#a39470] shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L14.5 8.5L21 9L16 13.5L17.5 20L12 16.5L6.5 20L8 13.5L3 9L9.5 8.5L12 2Z" />
                </svg>
                <span>Elyos</span>
              </div>

              <div class="grid grid-cols-2 gap-x-2">
                <div
                  v-for="(col, colIdx) in elyosColumns"
                  :key="`elyos-col-${colIdx}`"
                  class="space-y-0.5"
                >
                  <button
                    v-for="srv in col"
                    :key="srv.serverId"
                    type="button"
                    class="w-full text-left px-2.5 py-1.5 rounded text-[13px] truncate transition-colors"
                    :class="
                      srv.serverId === selectedServerId
                        ? 'bg-[#4393e6] text-white font-semibold'
                        : 'text-[#d1d5db] hover:bg-[#22252e] hover:text-white'
                    "
                    @click="selectServer(srv.serverId)"
                  >
                    {{ srv.name }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Asmodian Column -->
            <div>
              <div class="flex items-center gap-1.5 text-[12px] text-[#8b92a0] pb-2 mb-2 border-b border-[#252830]">
                <svg class="w-3.5 h-3.5 text-[#9384a8] shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L14.5 8.5L21 9L16 13.5L17.5 20L12 16.5L6.5 20L8 13.5L3 9L9.5 8.5L12 2Z" />
                </svg>
                <span>Asmodian</span>
              </div>

              <div class="grid grid-cols-2 gap-x-2">
                <div
                  v-for="(col, colIdx) in asmodianColumns"
                  :key="`asmo-col-${colIdx}`"
                  class="space-y-0.5"
                >
                  <button
                    v-for="srv in col"
                    :key="srv.serverId"
                    type="button"
                    class="w-full text-left px-2.5 py-1.5 rounded text-[13px] truncate transition-colors"
                    :class="
                      srv.serverId === selectedServerId
                        ? 'bg-[#4393e6] text-white font-semibold'
                        : 'text-[#d1d5db] hover:bg-[#22252e] hover:text-white'
                    "
                    @click="selectServer(srv.serverId)"
                  >
                    {{ srv.name }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-[#111318] border border-[#1e222a] rounded-lg p-3.5 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="ql-segmented-bar">
          <button
            v-for="cat in categories"
            :key="cat.id"
            type="button"
            class="ql-segmented-btn"
            :class="{ active: selectedCategory === cat.id }"
            @click="selectCategory(cat.id)"
          >
            <span>{{ cat.label }}</span>
            <span class="ql-segmented-count">{{ categoryCounts[cat.id] || 0 }}</span>
          </button>
        </div>
      </div>

      <div class="space-y-2.5">
        <div
          v-for="group in equipmentGroups"
          :key="group.key"
          class="space-y-1.5"
        >
          <div class="text-[11px] text-[#7a818e]">
            {{ group.label }}
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9 gap-1.5">
            <button
              v-for="chain in group.items"
              :key="chain.key"
              type="button"
              class="group flex items-center gap-2 p-1.5 rounded-md border text-left transition-colors"
              :class="
                selectedSlot === chain.slot
                  ? 'bg-[#1d212a] border-[#383f4e]'
                  : 'bg-[#14171d] border-transparent hover:bg-[#181c24] hover:border-[#242934]'
              "
              @click="selectSlot(chain.slot)"
            >
              <div class="ql-icon-frame grade-fabled w-7 h-7">
                <img
                  v-if="getSlotIcon(chain) && !brokenIcons[chain.key]"
                  :src="getSlotIcon(chain)"
                  :alt="chain.slot"
                  class="w-full h-full object-cover"
                  loading="lazy"
                  @error="brokenIcons[chain.key] = true"
                />
                <span v-else class="text-[9px] font-bold text-[#eab308]">
                  {{ chain.slot.slice(0, 2).toUpperCase() }}
                </span>
              </div>

              <span
                class="text-[12px] font-medium truncate transition-colors"
                :class="
                  selectedSlot === chain.slot
                    ? 'text-[#eab308] font-semibold'
                    : 'text-[#d1d5db] group-hover:text-white'
                "
              >
                {{ chain.slot }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
