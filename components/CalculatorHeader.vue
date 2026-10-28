<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDragonChains, formatIconUrl, formatRegionName } from '~/composables/useDragonChains'
import { useTransferCalculator } from '~/composables/useTransferCalculator'
import type { DragonCategoryFilter, DragonEquipmentCategory, DragonRace } from '~/types/dragon'

const {
  serversByRegion,
  activeServer,
  selectedServerId,
  selectedRace,
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

const onServerChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  if (target?.value) {
    changeServer(Number(target.value))
  }
}

const setFaction = (race: DragonRace) => {
  selectedRace.value = race
}

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

      <div class="flex items-center gap-2 self-start shrink-0">
        <div
          class="relative inline-flex items-center bg-[#151820] hover:bg-[#1a1e28] border border-[#252934] rounded-md px-3 py-1.5 transition-colors cursor-pointer"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-[#a855f7] mr-2 shrink-0" />
          <div class="flex items-baseline text-[12px] pr-4">
            <span class="font-semibold text-white">
              {{ activeServer?.name || 'Lumiel' }}
            </span>
            <span class="text-[#7a818e] ml-0.5">
              {{ formatRegionName(activeServer?.region) }}
            </span>
          </div>
          <svg
            class="w-3 h-3 text-[#7a818e] absolute right-2.5 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
          </svg>

          <select
            :value="selectedServerId"
            aria-label="Select Server"
            class="absolute inset-0 w-full h-full opacity-0 cursor-pointer bg-[#151820] text-white"
            @change="onServerChange"
          >
            <optgroup
              v-for="group in serversByRegion"
              :key="group.region"
              :label="group.label"
              class="bg-[#151820] text-white"
            >
              <option
                v-for="srv in group.servers"
                :key="srv.serverId"
                :value="srv.serverId"
                class="bg-[#151820] text-white"
              >
                {{ srv.name }} ({{ group.label }} · {{ srv.race === 1 ? 'Elyos' : 'Asmodian' }})
              </option>
            </optgroup>
          </select>
        </div>

        <div class="ql-segmented-bar">
          <button
            type="button"
            class="ql-segmented-btn"
            :class="{ active: selectedRace === 'light' }"
            @click="setFaction('light')"
          >
            Elyos
          </button>
          <button
            type="button"
            class="ql-segmented-btn"
            :class="{ active: selectedRace === 'dark' }"
            @click="setFaction('dark')"
          >
            Asmodian
          </button>
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
