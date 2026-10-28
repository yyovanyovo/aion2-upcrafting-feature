<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatIconUrl } from '~/composables/useDragonChains'
import { useTransferCalculator } from '~/composables/useTransferCalculator'
import type { ResolvedIngredient } from '~/types/dragon'

const {
  aggregatedMaterials,
  expandedRawMaterials,
  totalCost
} = useTransferCalculator()

const expandSubCrafts = ref(true)
const brokenIcons = ref<Record<string, boolean>>({})

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
  aggregatedMaterials.value.some((m) => m.method === 'Craft' && m.subIngredients.length > 0)
)

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

    <div class="overflow-x-auto">
      <table class="w-full table-fixed text-left border-collapse">
        <colgroup>
          <col />
          <col class="w-[96px]" />
          <col class="w-[156px]" />
          <col class="w-[140px]" />
        </colgroup>
        <thead>
          <tr class="border-b border-[#1a1d24] text-[11px] text-[#7a818e]">
            <th class="py-2 px-4 font-normal">Item</th>
            <th class="py-2 px-3 font-normal text-right">Required</th>
            <th class="py-2 px-3 font-normal text-right">Unit price</th>
            <th class="py-2 px-4 font-normal text-right">Cost ↓</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#181b22] text-[13px]">
          <tr
            v-for="item in displayedMaterials"
            :key="item.id"
            class="hover:bg-[#14171e] transition-colors"
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

                <span
                  class="text-[13px] font-medium"
                  :class="getGradeTitleClass(item.grade)"
                >
                  {{ item.name }}
                </span>
              </div>
            </td>

            <td class="py-2.5 px-3 text-right ql-num font-semibold text-white whitespace-nowrap">
              {{ item.quantity.toLocaleString('en-US') }}
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
                </template>
              </div>
            </td>

            <td class="py-2.5 px-4 text-right ql-num font-bold text-white whitespace-nowrap">
              {{ item.isPriceMissing ? '—' : formatNumber(item.totalCost) }}
            </td>
          </tr>
        </tbody>

        <tfoot class="border-t border-[#1e222a] bg-[#0e1014]">
          <tr>
            <td colspan="3" class="py-2.5 px-4 text-right text-[12px] text-[#8b92a0]">
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
