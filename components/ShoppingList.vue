<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatIconUrl } from '~/composables/useDragonChains'
import { useTransferCalculator } from '~/composables/useTransferCalculator'
import type { ResolvedIngredient } from '~/types/dragon'

const {
  aggregatedMaterials,
  expandedRawMaterials,
  totalCost,
  totalOwnedSavings,
  hasOwnedMaterials,
  forceCraftSubMaterials,
  toggleForceCraftSubMaterials,
  setTotalOwnedMaterial,
  resetOwnedMaterials
} = useTransferCalculator()

const expandSubCrafts = ref(true)
const brokenIcons = ref<Record<string, boolean>>({})
const expandedRows = ref<Record<string, boolean>>({})

const displayedMaterials = computed<ResolvedIngredient[]>(() => {
  const source = expandSubCrafts.value
    ? expandedRawMaterials.value
    : aggregatedMaterials.value

  return [...source].sort((a, b) => {
    if (a.isPrecursorEquipment !== b.isPrecursorEquipment) {
      return a.isPrecursorEquipment ? -1 : 1
    }
    return b.totalCost - a.totalCost
  })
})

const hasSubCraftItems = computed(() =>
  aggregatedMaterials.value.some((m) => m.subIngredients.length > 0)
)

const buyCheaperSubCraftItems = computed<ResolvedIngredient[]>(() =>
  aggregatedMaterials.value.filter(
    (m) => m.isBuyCheaperThanCraft && m.buyPrice !== null && m.craftPrice !== null
  )
)

const totalSmartBuySavings = computed<number>(() =>
  buyCheaperSubCraftItems.value.reduce((sum, item) => {
    const diff = (item.craftPrice || 0) - (item.buyPrice || 0)
    return sum + Math.max(0, diff * item.remainingQuantity)
  }, 0)
)

const isRowExpandable = (item: ResolvedIngredient): boolean => {
  if (expandSubCrafts.value) {
    return (
      Boolean(item.usedForCrafts && item.usedForCrafts.length > 0) ||
      item.subIngredients.length > 0
    )
  }
  return item.subIngredients.length > 0
}

const getRowExpandKey = (item: ResolvedIngredient): string => {
  return `${expandSubCrafts.value ? 'raw' : 'stage'}-${item.id}`
}

const isRowExpanded = (item: ResolvedIngredient): boolean => {
  return Boolean(expandedRows.value[getRowExpandKey(item)])
}

const toggleRowExpand = (item: ResolvedIngredient) => {
  if (!isRowExpandable(item)) return
  const key = getRowExpandKey(item)
  expandedRows.value = {
    ...expandedRows.value,
    [key]: !expandedRows.value[key]
  }
}

const getDirectOwnedValue = (item: ResolvedIngredient): number => {
  if (expandSubCrafts.value && item.usedForCrafts && item.usedForCrafts.length > 0) {
    return item.rawAllocatedOwned || 0
  }
  return item.allocatedOwned
}

const getMaxDirectOwned = (item: ResolvedIngredient): number => {
  if (expandSubCrafts.value && item.usedForCrafts && item.usedForCrafts.length > 0) {
    return Math.max(0, item.quantity - (item.allocatedFromParentCrafts || 0))
  }
  return item.quantity
}

const getRawTotalNeededForSub = (parentItem: ResolvedIngredient, sub: ResolvedIngredient): number => {
  const rawItem = expandedRawMaterials.value.find((r) => r.id === sub.id)
  const fromExpanded = rawItem
    ? Math.max(0, rawItem.quantity - (rawItem.allocatedFromParentCrafts || 0))
    : 0
  if (parentItem.method === 'Buy') {
    return fromExpanded + Math.max(0, sub.quantity - (sub.allocatedFromParentCrafts || 0))
  }
  return fromExpanded || Math.max(0, sub.quantity - (sub.allocatedFromParentCrafts || 0))
}

const getRawOwnedForSub = (sub: ResolvedIngredient): number => {
  const rawItem = expandedRawMaterials.value.find((r) => r.id === sub.id)
  if (rawItem) {
    return rawItem.rawAllocatedOwned || 0
  }
  return sub.rawAllocatedOwned || 0
}

const onShoppingOwnedInput = (itemId: string, maxQuantity: number, event: Event) => {
  const target = event.target as HTMLInputElement
  setTotalOwnedMaterial(itemId, target.value, maxQuantity)
}

const formatNumber = (val: number | null | undefined): string => {
  if (val === null || val === undefined || Number.isNaN(val)) return '—'
  return Math.round(val).toLocaleString('en-US')
}

const getGradeFrameClass = (grade: number): string => {
  if (grade >= 41) return 'grade-fabled'
  if (grade >= 31) return 'grade-heroic'
  if (grade >= 21) return 'grade-superior'
  return 'grade-common'
}

const getGradeTitleClass = (grade: number): string => {
  if (grade >= 41) return 'ql-item-fabled'
  if (grade >= 31) return 'ql-item-heroic'
  if (grade >= 21) return 'ql-item-superior'
  return 'ql-item-common'
}

const getCraftNoun = (name: string, plural = false): string => {
  const lower = (name || '').toLowerCase()
  if (lower.includes('horn')) return plural ? 'horns' : 'horn'
  if (lower.includes('leather')) return plural ? 'leathers' : 'leather'
  if (lower.includes('scale')) return plural ? 'scales' : 'scale'
  return plural ? 'items' : 'item'
}

const getCraftTargetsSummaryLabel = (item: ResolvedIngredient): string => {
  const targets = item.usedForCrafts || []
  if (targets.length === 0) return ''
  const totalRemaining = targets.reduce((sum, t) => sum + t.parentRemainingToCraft, 0)
  const totalBase = targets.reduce((sum, t) => sum + t.parentTotalQuantity, 0)
  const count = totalRemaining > 0 ? totalRemaining : totalBase
  if (targets.length === 1) {
    const t = targets[0]
    return `Crafts ${count}× ${t.parentName}`
  }
  const noun = getCraftNoun(targets[0].parentName, count !== 1)
  return `Crafts ${count} ${noun} (${targets.length} types)`
}
</script>

<template>
  <section class="bg-[#111318] border border-[#1e222a] rounded-lg overflow-hidden">
    <div class="px-4 py-3 border-b border-[#1a1d24] flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <svg
          class="w-4 h-4 text-[#8b92a0]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <h2 class="text-[14px] font-bold text-white">
          Shopping List
        </h2>
      </div>

      <div class="flex items-center gap-2">
        <button
          v-if="hasOwnedMaterials"
          type="button"
          class="px-2.5 py-1 rounded-md bg-[#181b22] hover:bg-[#222631] border border-[#252934] text-[11px] font-medium text-[#cbd5e1] transition-colors"
          @click="resetOwnedMaterials"
        >
          Clear owned
        </button>

        <div v-if="hasSubCraftItems" class="ql-segmented-bar">
          <button
            type="button"
            class="ql-segmented-btn"
            :class="{ active: expandSubCrafts }"
            @click="expandSubCrafts = true"
          >
            Raw Materials
          </button>
          <button
            type="button"
            class="ql-segmented-btn"
            :class="{ active: !expandSubCrafts }"
            @click="expandSubCrafts = false"
          >
            Stage Materials
          </button>
        </div>
      </div>
    </div>

    <!-- Smart Buy vs. Craft banner in Raw Materials when any Balaur Horn/Scale/Leather is cheaper on Market than crafting -->
    <div
      v-if="expandSubCrafts && buyCheaperSubCraftItems.length > 0"
      class="px-4 py-2 border-b border-[#1a1d24] bg-[#0d1117] flex items-center justify-between gap-3 text-[12px]"
    >
      <div class="flex items-center gap-2 min-w-0 flex-1 text-[#94a3b8]">
        <svg
          class="w-3.5 h-3.5 text-[#38bdf8] shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div v-if="!forceCraftSubMaterials" class="ql-num leading-snug">
          <span class="text-white font-semibold mr-1.5">Smart Buy vs. Craft:</span>
          <span>Buying </span>
          <template v-for="(bItem, idx) in buyCheaperSubCraftItems" :key="bItem.id">
            <span v-if="idx > 0" class="text-[#646b78]">{{ idx === buyCheaperSubCraftItems.length - 1 ? ' & ' : ', ' }}</span>
            <span :class="getGradeTitleClass(bItem.grade)" class="font-medium">{{ bItem.name }}</span>
          </template>
          <span> on the market instead of crafting</span>
          <span v-if="totalSmartBuySavings > 0" class="text-[#22c55e] font-medium ml-1">
            (saves {{ formatNumber(totalSmartBuySavings) }})
          </span>
        </div>
        <div v-else class="ql-num leading-snug">
          <span class="text-[#38bdf8] font-semibold mr-1.5">Craft All Mode:</span>
          <span>Expanding all Balaur materials into raw ingredients</span>
          <span v-if="totalSmartBuySavings > 0" class="text-[#eab308] font-medium ml-1">
            (+{{ formatNumber(totalSmartBuySavings) }} vs. Market Buy)
          </span>
        </div>
      </div>

      <button
        type="button"
        class="px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors shrink-0"
        :class="
          forceCraftSubMaterials
            ? 'bg-[#13202c] hover:bg-[#192a3a] border-[#38bdf8]/40 text-[#38bdf8]'
            : 'bg-[#181b22] hover:bg-[#222631] border-[#252934] text-[#cbd5e1]'
        "
        @click="toggleForceCraftSubMaterials"
      >
        {{ forceCraftSubMaterials ? 'Use Smart Buy/Craft' : 'Craft All Instead' }}
      </button>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full table-fixed text-left border-collapse">
        <colgroup>
          <col />
          <col class="w-[104px]" />
          <col class="w-[86px]" />
          <col class="w-[148px]" />
          <col class="w-[136px]" />
        </colgroup>
        <thead>
          <tr class="border-b border-[#1a1d24] text-[11px] text-[#7a818e]">
            <th class="py-2 px-4 font-normal">Item</th>
            <th class="py-2 px-2.5 font-normal text-right">Owned</th>
            <th class="py-2 px-3 font-normal text-right">Required</th>
            <th class="py-2 px-3 font-normal text-right">Unit price</th>
            <th class="py-2 px-4 font-normal text-right">Cost ↓</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#181b22] text-[13px]">
          <template v-for="item in displayedMaterials" :key="item.id">
            <tr
              class="hover:bg-[#14171e] transition-colors"
              :class="[
                item.remainingQuantity === 0 ||
                (item.subIngredients.length > 0 &&
                  item.remainingCost === 0 &&
                  (item.craftableFromRaw || 0) === item.remainingQuantity)
                  ? 'bg-[#0f1915]/40'
                  : '',
                isRowExpandable(item) ? 'cursor-pointer select-none' : ''
              ]"
              @click="toggleRowExpand(item)"
            >
              <td class="py-2.5 px-4">
                <div class="flex items-center gap-3">
                  <div
                    class="ql-icon-frame w-8 h-8"
                    :class="getGradeFrameClass(item.grade)"
                  >
                    <img
                      v-if="formatIconUrl(item.icon) && !brokenIcons[item.id]"
                      :src="formatIconUrl(item.icon)"
                      :alt="item.name"
                      class="w-full h-full object-cover"
                      loading="lazy"
                      @error="brokenIcons[item.id] = true"
                    />
                    <span v-else class="text-[9px] font-bold text-[#8b92a0]">
                      {{ item.name.slice(0, 2).toUpperCase() }}
                    </span>
                  </div>

                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span
                        class="text-[13px] font-medium leading-tight"
                        :class="[
                          getGradeTitleClass(item.grade),
                          item.remainingQuantity === 0 ||
                          (item.subIngredients.length > 0 &&
                            item.remainingCost === 0 &&
                            (item.craftableFromRaw || 0) === item.remainingQuantity)
                            ? 'line-through opacity-75'
                            : ''
                        ]"
                      >
                        {{ item.name }}
                      </span>

                      <button
                        v-if="isRowExpandable(item)"
                        type="button"
                        class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium transition-colors ql-num"
                        :class="
                          item.isBuyCheaperThanCraft && item.method === 'Buy'
                            ? 'bg-[#11221c] hover:bg-[#162d25] border-[#22c55e]/30 text-[#4ade80]'
                            : 'bg-[#181c24] hover:bg-[#222733] border-[#262b38] text-[#94a3b8] hover:text-white'
                        "
                        @click.stop="toggleRowExpand(item)"
                      >
                        <template v-if="expandSubCrafts && item.usedForCrafts?.length">
                          <span>{{ getCraftTargetsSummaryLabel(item) }}</span>
                        </template>
                        <template v-else-if="item.isBuyCheaperThanCraft && item.method === 'Buy'">
                          <span>Buy &lt; Craft ({{ formatNumber(item.craftPrice) }}) · Recipe</span>
                        </template>
                        <template v-else>
                          <span>Recipe ({{ item.subIngredients.length }})</span>
                        </template>
                        <svg
                          class="w-3 h-3 transition-transform duration-150"
                          :class="{ 'rotate-180': isRowExpanded(item) }"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    <div class="text-[11px] leading-tight mt-0.5 ql-num">
                      <span
                        v-if="item.remainingQuantity === 0"
                        class="text-[#22c55e] font-medium"
                      >
                        0 more needed ({{ item.allocatedOwned.toLocaleString('en-US') }}/{{ item.quantity.toLocaleString('en-US') }})
                      </span>
                      <span
                        v-else-if="
                          item.subIngredients.length > 0 &&
                          (item.craftableFromRaw || 0) === item.remainingQuantity &&
                          item.remainingCost === 0
                        "
                        class="text-[#22c55e] font-medium"
                      >
                        Ready to craft {{ item.craftableFromRaw }} from owned raw mats
                        <template v-if="item.allocatedOwned > 0">
                          ({{ item.allocatedOwned }} owned)
                        </template>
                      </span>
                      <span
                        v-else-if="
                          item.subIngredients.length > 0 &&
                          ((item.craftableFromRaw || 0) > 0 || (item.rawCostSavings || 0) > 0)
                        "
                        class="text-[#38bdf8]"
                      >
                        <template v-if="(item.craftableFromRaw || 0) > 0">
                          {{ item.craftableFromRaw }}/{{ item.remainingQuantity }} craftable from raw mats ·
                        </template>
                        {{ item.remainingQuantity - (item.craftableFromRaw || 0) }} more to cover
                      </span>
                      <span
                        v-else-if="item.allocatedOwned > 0"
                        class="text-[#eab308]"
                      >
                        {{ item.remainingQuantity.toLocaleString('en-US') }} more needed ({{ item.allocatedOwned.toLocaleString('en-US') }}/{{ item.quantity.toLocaleString('en-US') }})
                        <template v-if="expandSubCrafts && (item.allocatedFromParentCrafts || 0) > 0">
                          · {{ item.allocatedFromParentCrafts }} in owned {{ getCraftNoun(item.usedForCrafts?.[0]?.parentName || '', true) }}
                        </template>
                      </span>
                      <span v-else class="text-[#7a818e]">
                        {{ item.remainingQuantity.toLocaleString('en-US') }} more needed
                      </span>
                    </div>
                  </div>
                </div>
              </td>

              <td class="py-2.5 px-2.5 text-right whitespace-nowrap" @click.stop>
                <input
                  type="number"
                  min="0"
                  :max="getMaxDirectOwned(item)"
                  step="1"
                  placeholder="0"
                  :value="getDirectOwnedValue(item) || ''"
                  :aria-label="`Total Owned ${item.name}`"
                  class="w-full bg-[#181b22] hover:bg-[#1d212a] focus:bg-[#1d212a] border rounded px-2 py-1 text-right text-[12px] ql-num focus:outline-none transition-colors"
                  :class="
                    getDirectOwnedValue(item) > 0
                      ? 'border-[#22c55e]/50 text-[#22c55e] font-semibold'
                      : 'border-[#252934] focus:border-[#3b82f6] text-white placeholder-[#4b515d]'
                  "
                  @input="onShoppingOwnedInput(item.id, getMaxDirectOwned(item), $event)"
                />
              </td>

              <td class="py-2.5 px-3 text-right ql-num whitespace-nowrap">
                <div
                  class="text-[13px] font-semibold leading-tight"
                  :class="
                    item.remainingQuantity === 0 ||
                    (item.subIngredients.length > 0 &&
                      (item.craftableFromRaw || 0) === item.remainingQuantity &&
                      item.remainingCost === 0)
                      ? 'text-[#22c55e]'
                      : 'text-white'
                  "
                >
                  {{
                    (item.subIngredients.length > 0
                      ? Math.max(0, item.remainingQuantity - (item.craftableFromRaw || 0))
                      : item.remainingQuantity
                    ).toLocaleString('en-US')
                  }}
                </div>
                <div class="text-[11px] text-[#646b78] leading-tight">
                  <template
                    v-if="
                      item.subIngredients.length > 0 &&
                      (item.allocatedOwned > 0 || (item.craftableFromRaw || 0) > 0)
                    "
                  >
                    {{ (item.allocatedOwned + (item.craftableFromRaw || 0)).toLocaleString('en-US') }}/{{ item.quantity.toLocaleString('en-US') }}
                  </template>
                  <template v-else-if="item.allocatedOwned > 0">
                    {{ item.allocatedOwned.toLocaleString('en-US') }}/{{ item.quantity.toLocaleString('en-US') }}
                  </template>
                  <template v-else>
                    ×{{ item.quantity.toLocaleString('en-US') }}
                  </template>
                </div>
              </td>

              <td class="py-2.5 px-3 text-right ql-num whitespace-nowrap">
                <div class="text-[13px] font-medium text-white leading-tight">
                  {{ item.isPriceMissing ? '—' : formatNumber(item.unitPrice) }}
                </div>
                <div class="text-[11px] text-[#7a818e] leading-tight mt-0.5">
                  <template v-if="item.method === 'Craft'">
                    <span class="text-[#38bdf8]">Craft</span>
                  </template>
                  <template v-else-if="item.isNpcSource">
                    NPC
                  </template>
                  <template v-else>
                    {{ item.listingsCount ? `${item.listingsCount} listings` : 'Market' }}
                    <span
                      v-if="item.isBuyCheaperThanCraft && item.craftPrice"
                      class="block text-[10px] text-[#22c55e]"
                    >
                      Saves {{ formatNumber(item.craftPrice - item.unitPrice) }}/ea
                    </span>
                  </template>
                </div>
              </td>

              <td class="py-2.5 px-4 text-right ql-num whitespace-nowrap">
                <div
                  class="font-bold leading-tight"
                  :class="
                    item.remainingQuantity === 0 || item.remainingCost === 0
                      ? 'text-[#22c55e]'
                      : 'text-white'
                  "
                >
                  {{ item.isPriceMissing ? '—' : formatNumber(item.remainingCost) }}
                </div>
                <div
                  v-if="!item.isPriceMissing && item.remainingCost < item.totalCost"
                  class="text-[11px] text-[#646b78] line-through leading-tight"
                >
                  {{ formatNumber(item.totalCost) }}
                </div>
              </td>
            </tr>

            <!-- Expandable Sub-rows in Raw Materials tab: shows which Scales/Horns/Leathers this raw material crafts into -->
            <template v-if="expandSubCrafts && isRowExpanded(item) && item.usedForCrafts?.length">
              <tr
                v-for="target in item.usedForCrafts"
                :key="`${item.id}-target-${target.parentItemId}`"
                class="bg-[#0c0e13] border-l-2 border-l-[#38bdf8]/50 text-[12px]"
              >
                <td class="py-2 pl-9 pr-4">
                  <div class="flex items-center gap-2.5">
                    <span class="text-[#475569] text-[11px] select-none">↳</span>
                    <div
                      class="ql-icon-frame w-6 h-6"
                      :class="getGradeFrameClass(target.parentGrade)"
                    >
                      <img
                        v-if="formatIconUrl(target.parentIcon) && !brokenIcons[`target-${target.parentItemId}`]"
                        :src="formatIconUrl(target.parentIcon)"
                        :alt="target.parentName"
                        class="w-full h-full object-cover"
                        loading="lazy"
                        @error="brokenIcons[`target-${target.parentItemId}`] = true"
                      />
                      <span v-else class="text-[8px] font-bold text-[#8b92a0]">
                        {{ target.parentName.slice(0, 2).toUpperCase() }}
                      </span>
                    </div>

                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <span
                          class="font-medium leading-tight"
                          :class="getGradeTitleClass(target.parentGrade)"
                        >
                          {{ target.parentName }}
                        </span>
                        <span class="px-1.5 py-0.2 rounded bg-[#161922] border border-[#232836] text-[10px] text-[#8b92a0] ql-num">
                          Stage {{ target.stages.join(', ') }}
                        </span>
                      </div>
                      <div class="text-[11px] text-[#646b78] leading-tight mt-0.5 ql-num">
                        Requires {{ target.rawPerParent }}× {{ item.name }} per {{ getCraftNoun(target.parentName, false) }} ({{ target.rawTotalQuantity }} total for {{ target.parentTotalQuantity }} {{ getCraftNoun(target.parentName, target.parentTotalQuantity !== 1) }})
                      </div>
                    </div>
                  </div>
                </td>

                <td class="py-2 px-2.5 text-right whitespace-nowrap ql-num">
                  <span
                    v-if="target.parentRemainingToCraft === 0"
                    class="inline-block px-2 py-0.5 rounded bg-[#11261b] border border-[#22c55e]/30 text-[11px] text-[#22c55e] font-medium"
                  >
                    {{ target.parentOwnedQuantity }}/{{ target.parentTotalQuantity }} owned
                  </span>
                  <span
                    v-else-if="target.parentCraftableFromRaw === target.parentRemainingToCraft"
                    class="inline-block px-2 py-0.5 rounded bg-[#11261b] border border-[#22c55e]/30 text-[11px] text-[#22c55e] font-medium"
                  >
                    {{ target.parentCraftableFromRaw }}/{{ target.parentRemainingToCraft }} ready
                  </span>
                  <span
                    v-else-if="target.parentCraftableFromRaw > 0"
                    class="inline-block px-2 py-0.5 rounded bg-[#13202c] border border-[#38bdf8]/30 text-[11px] text-[#38bdf8] font-medium"
                  >
                    {{ target.parentCraftableFromRaw }}/{{ target.parentRemainingToCraft }} ready
                  </span>
                  <span
                    v-else
                    class="text-[11px] text-[#8b92a0]"
                  >
                    {{ target.parentRemainingToCraft }} to craft
                  </span>
                </td>

                <td class="py-2 px-3 text-right ql-num whitespace-nowrap">
                  <div
                    class="font-semibold leading-tight"
                    :class="target.rawRemainingQuantity === 0 ? 'text-[#22c55e]' : 'text-[#cbd5e1]'"
                  >
                    {{ target.rawRemainingQuantity.toLocaleString('en-US') }}
                  </div>
                  <div class="text-[10px] text-[#646b78] leading-tight">
                    {{ target.rawAllocatedOwned.toLocaleString('en-US') }}/{{ target.rawRequiredQuantity.toLocaleString('en-US') }} {{ item.name.split(' ')[0] }}
                  </div>
                </td>

                <td colspan="2" class="py-2 px-4 text-right ql-num whitespace-nowrap">
                  <span class="text-[11px] text-[#94a3b8]">
                    Craft <strong class="text-white">{{ target.parentRemainingToCraft }}×</strong> {{ getCraftNoun(target.parentName, target.parentRemainingToCraft !== 1) }}
                  </span>
                </td>
              </tr>
            </template>

            <!-- Expandable Sub-rows for any item with subIngredients (in Stage Materials OR Buy-cheaper items in Raw Materials) -->
            <template
              v-if="
                isRowExpanded(item) &&
                item.subIngredients.length &&
                (!expandSubCrafts || !item.usedForCrafts?.length)
              "
            >
              <tr
                v-for="sub in item.subIngredients"
                :key="`${item.id}-sub-${sub.id}`"
                class="bg-[#0c0e13] border-l-2 border-l-[#38bdf8]/50 text-[12px]"
              >
                <td class="py-2 pl-9 pr-4">
                  <div class="flex items-center gap-2.5">
                    <span class="text-[#475569] text-[11px] select-none">↳</span>
                    <div
                      class="ql-icon-frame w-6 h-6"
                      :class="getGradeFrameClass(sub.grade)"
                    >
                      <img
                        v-if="formatIconUrl(sub.icon) && !brokenIcons[`sub-${sub.id}`]"
                        :src="formatIconUrl(sub.icon)"
                        :alt="sub.name"
                        class="w-full h-full object-cover"
                        loading="lazy"
                        @error="brokenIcons[`sub-${sub.id}`] = true"
                      />
                      <span v-else class="text-[8px] font-bold text-[#8b92a0]">
                        {{ sub.name.slice(0, 2).toUpperCase() }}
                      </span>
                    </div>

                    <div class="min-w-0">
                      <div
                        class="font-medium leading-tight"
                        :class="[
                          getGradeTitleClass(sub.grade),
                          sub.remainingQuantity === 0 ? 'line-through opacity-75' : ''
                        ]"
                      >
                        {{ sub.name }}
                      </div>
                      <div class="text-[11px] text-[#646b78] leading-tight mt-0.5 ql-num">
                        {{ sub.perCraftQuantity || 1 }}× per craft ·
                        <span v-if="sub.remainingQuantity === 0" class="text-[#22c55e]">
                          0 more needed ({{ sub.allocatedOwned }}/{{ sub.quantity }})
                        </span>
                        <span v-else class="text-[#8b92a0]">
                          {{ sub.remainingQuantity }} more needed ({{ sub.allocatedOwned }}/{{ sub.quantity }})
                        </span>
                      </div>
                    </div>
                  </div>
                </td>

                <td class="py-2 px-2.5 text-right whitespace-nowrap" @click.stop>
                  <input
                    type="number"
                    min="0"
                    :max="getRawTotalNeededForSub(item, sub)"
                    step="1"
                    placeholder="0"
                    :value="getRawOwnedForSub(sub) || ''"
                    :aria-label="`Total Owned ${sub.name}`"
                    class="w-full bg-[#151820] hover:bg-[#1d212a] focus:bg-[#1d212a] border rounded px-2 py-0.5 text-right text-[11px] ql-num focus:outline-none transition-colors"
                    :class="
                      getRawOwnedForSub(sub) > 0
                        ? 'border-[#22c55e]/50 text-[#22c55e] font-semibold'
                        : 'border-[#252934] focus:border-[#3b82f6] text-white placeholder-[#4b515d]'
                    "
                    @input="onShoppingOwnedInput(sub.id, getRawTotalNeededForSub(item, sub), $event)"
                  />
                </td>

                <td class="py-2 px-3 text-right ql-num whitespace-nowrap">
                  <div
                    class="font-semibold leading-tight"
                    :class="sub.remainingQuantity === 0 ? 'text-[#22c55e]' : 'text-[#cbd5e1]'"
                  >
                    {{ sub.remainingQuantity.toLocaleString('en-US') }}
                  </div>
                  <div class="text-[10px] text-[#646b78] leading-tight">
                    {{ sub.allocatedOwned.toLocaleString('en-US') }}/{{ sub.quantity.toLocaleString('en-US') }}
                  </div>
                </td>

                <td class="py-2 px-3 text-right ql-num whitespace-nowrap">
                  <div class="text-[#cbd5e1] leading-tight">
                    {{ formatNumber(sub.unitPrice) }}
                  </div>
                  <div class="text-[10px] text-[#646b78] leading-tight">
                    {{ sub.isNpcSource ? 'NPC' : sub.listingsCount ? `${sub.listingsCount} listings` : 'Market' }}
                  </div>
                </td>

                <td class="py-2 px-4 text-right ql-num whitespace-nowrap">
                  <div
                    class="font-semibold leading-tight"
                    :class="sub.remainingQuantity === 0 ? 'text-[#22c55e]' : 'text-[#cbd5e1]'"
                  >
                    {{ formatNumber(sub.remainingCost) }}
                  </div>
                  <div
                    v-if="sub.remainingCost < sub.totalCost"
                    class="text-[10px] text-[#646b78] line-through leading-tight"
                  >
                    {{ formatNumber(sub.totalCost) }}
                  </div>
                </td>
              </tr>
            </template>
          </template>
        </tbody>

        <tfoot class="border-t border-[#1e222a] bg-[#0e1014]">
          <tr v-if="totalOwnedSavings > 0" class="border-b border-[#181b22]">
            <td colspan="4" class="py-2 px-4 text-right text-[12px] text-[#8b92a0]">
              Saved from owned materials
            </td>
            <td class="py-2 px-4 text-right text-[13px] font-semibold text-[#22c55e] ql-num whitespace-nowrap">
              -{{ formatNumber(totalOwnedSavings) }}
            </td>
          </tr>
          <tr>
            <td colspan="4" class="py-2.5 px-4 text-right text-[12px] text-[#8b92a0]">
              Total cost
            </td>
            <td class="py-2.5 px-4 text-right text-[14px] font-bold text-white ql-num whitespace-nowrap">
              {{ formatNumber(totalCost) }}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  </section>
</template>
