<script setup lang="ts">
import { computed } from 'vue'
import { useTransferCalculator } from '~/composables/useTransferCalculator'

const {
  steps,
  skippedSteps,
  totalCostWithoutProcs,
  expectedProcSavings,
  expectedAverageCost,
  totalProcSavings,
  totalCost
} = useTransferCalculator()

const expectedDiscountPercent = computed(() => {
  if (!totalCostWithoutProcs.value) return 0
  return ((expectedProcSavings.value / totalCostWithoutProcs.value) * 100).toFixed(1)
})

const simulatedDiscountPercent = computed(() => {
  if (!totalCostWithoutProcs.value) return 0
  return ((totalProcSavings.value / totalCostWithoutProcs.value) * 100).toFixed(1)
})

const formatNumber = (val: number | null | undefined): string => {
  if (val === null || val === undefined || Number.isNaN(val)) return '—'
  return Math.round(val).toLocaleString('en-US')
}
</script>

<template>
  <div class="space-y-3">
    <section class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div class="bg-[#111318] border border-[#1e222a] rounded-lg p-4">
        <div class="text-[12px] text-[#8b92a0]">
          Worst-case cost
        </div>
        <div class="text-[26px] font-bold text-white leading-tight mt-0.5 ql-num">
          {{ formatNumber(totalCostWithoutProcs) }}
        </div>
        <div class="text-[12px] text-[#7a818e] mt-1 ql-num">
          0 procs · {{ steps.length }} {{ steps.length === 1 ? 'stage' : 'stages' }}
        </div>
        <div class="text-[12px] text-[#7a818e] ql-num">
          Full pity if all 25% rolls miss
        </div>
      </div>

      <div class="bg-[#111318] border border-[#1e222a] rounded-lg p-4">
        <div class="text-[12px] text-[#8b92a0]">
          Expected average cost
        </div>
        <div class="text-[26px] font-bold text-white leading-tight mt-0.5 ql-num">
          {{ formatNumber(expectedAverageCost) }}
        </div>
        <div class="text-[12px] text-[#7a818e] mt-1 ql-num">
          {{ expectedDiscountPercent }}% cheaper than worst-case ({{ formatNumber(totalCostWithoutProcs) }})
        </div>
        <div class="text-[12px] text-[#7a818e] ql-num">
          -{{ formatNumber(expectedProcSavings) }} from 25% Splendent procs
        </div>
      </div>

      <div class="bg-[#11161b] border border-[#1f4b5e] rounded-lg p-4">
        <div class="text-[12px] text-[#8b92a0]">
          Simulated cost
        </div>
        <div
          class="text-[26px] font-bold leading-tight mt-0.5 ql-num"
          :class="skippedSteps.length > 0 ? 'text-[#22c55e]' : 'text-white'"
        >
          {{ formatNumber(totalCost) }}
        </div>
        <div class="text-[12px] text-[#7a818e] mt-1 ql-num">
          <template v-if="totalProcSavings > 0">
            -{{ formatNumber(totalProcSavings) }} saved ({{ simulatedDiscountPercent }}% off)
          </template>
          <template v-else>
            {{ skippedSteps.length }} proc skips active
          </template>
        </div>
      </div>
    </section>

    <div class="bg-[#111318] border border-[#1e222a] rounded-lg px-4 py-2.5 text-[12px] text-[#d1d5db] flex items-center gap-2">
      <svg
        class="w-4 h-4 text-[#38bdf8] shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
        />
      </svg>
      <span>
        <strong class="text-white font-semibold">25%</strong> of attempts on Stages 1, 3, and 5 give the
        <span class="text-[#eab308] font-medium">Splendent</span> stage directly.
      </span>
    </div>
  </div>
</template>
