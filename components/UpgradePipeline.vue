<script setup lang="ts">
import { ref } from 'vue'
import { formatIconUrl } from '~/composables/useDragonChains'
import { useTransferCalculator } from '~/composables/useTransferCalculator'
import type { StageCalculationStep } from '~/types/dragon'

const {
  steps,
  procSkips,
  skippableStages,
  toggleProcSkip,
  getStageOwnedMaterial,
  setStageOwnedMaterial
} = useTransferCalculator()

const brokenIcons = ref<Record<string, boolean>>({})

const formatNumber = (val: number | null | undefined): string => {
  if (val === null || val === undefined || Number.isNaN(val)) return '—'
  return Math.round(val).toLocaleString('en-US')
}

const getNextEvenStage = (stage: number): 2 | 4 | 6 | null => {
  if (stage === 1) return 2
  if (stage === 3) return 4
  if (stage === 5) return 6
  return null
}

const canSimulateProcFromOddStage = (step: StageCalculationStep): boolean => {
  const nextEven = getNextEvenStage(step.stage)
  if (!nextEven) return false
  return Boolean(skippableStages.value[nextEven])
}

const isOddStageProcActive = (step: StageCalculationStep): boolean => {
  const nextEven = getNextEvenStage(step.stage)
  if (!nextEven) return false
  return Boolean(skippableStages.value[nextEven] && procSkips.value[nextEven])
}

const onOwnedInput = (stage: number, itemId: string, maxQuantity: number, event: Event) => {
  const target = event.target as HTMLInputElement
  setStageOwnedMaterial(stage, itemId, target.value, maxQuantity)
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
  <section class="space-y-3">
    <div
      v-for="step in steps"
      :key="step.stage"
      class="bg-[#111318] border rounded-lg overflow-hidden transition-opacity"
      :class="
        step.isSkipped
          ? 'border-[#1d3b2a] opacity-55 hover:opacity-85'
          : 'border-[#1e222a]'
      "
    >
      <div
        v-if="step.isSkipped"
        class="bg-[#11261b] border-b border-[#1d3b2a] px-4 py-1.5 flex items-center justify-between text-[12px]"
      >
        <span class="font-medium text-[#22c55e] ql-num">
          Skipped via 25% Proc! (-{{ formatNumber(step.stageTotalCost) }} saved)
        </span>
        <button
          type="button"
          class="text-[11px] text-[#8b92a0] hover:text-white"
          @click="toggleProcSkip(step.stage as 2 | 4 | 6)"
        >
          Undo
        </button>
      </div>

      <div class="px-4 py-3 border-b border-[#1a1d24] flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2.5 min-w-0">
          <div
            class="ql-icon-frame w-8 h-8"
            :class="getGradeFrameClass(step.grade)"
          >
            <img
              v-if="formatIconUrl(step.icon) && !brokenIcons[`step-${step.stage}`]"
              :src="formatIconUrl(step.icon)"
              :alt="step.name"
              class="w-full h-full object-cover"
              loading="lazy"
              @error="brokenIcons[`step-${step.stage}`] = true"
            />
            <span v-else class="text-[10px] font-bold text-[#eab308]">
              {{ step.stage }}
            </span>
          </div>

          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span
                class="text-[14px] font-bold leading-tight"
                :class="[
                  getGradeTitleClass(step.grade),
                  step.isSkipped ? 'line-through' : ''
                ]"
              >
                Stage {{ step.stage }} · {{ step.name }}
              </span>
            </div>

            <div class="text-[11px] leading-tight mt-0.5">
              <span v-if="step.stage % 2 === 1" class="text-[#d99b26]">
                25% {{ step.comboProductItem?.name || 'Splendent Proc Chance' }}
              </span>
              <span v-else class="text-[#7a818e]">
                100% Guaranteed Upcraft
              </span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-4 shrink-0">
          <label
            v-if="step.stage % 2 === 1 && canSimulateProcFromOddStage(step)"
            class="inline-flex items-center gap-2 px-2.5 py-1 rounded-md border text-[12px] cursor-pointer select-none transition-colors"
            :class="
              isOddStageProcActive(step)
                ? 'bg-[#132a1e] border-[#22c55e]/40 text-[#22c55e] font-medium'
                : 'bg-[#171a22] border-[#252934] hover:border-[#383f4e] text-[#cbd5e1]'
            "
          >
            <input
              type="checkbox"
              class="sr-only"
              :checked="isOddStageProcActive(step)"
              @change="toggleProcSkip(getNextEvenStage(step.stage)!)"
            />
            <span
              class="w-7 h-3.5 rounded-full relative transition-colors flex items-center p-0.5"
              :class="isOddStageProcActive(step) ? 'bg-[#22c55e]' : 'bg-[#2d323e]'"
            >
              <span
                class="w-2.5 h-2.5 rounded-full bg-white transition-transform"
                :class="isOddStageProcActive(step) ? 'translate-x-3.5' : 'translate-x-0'"
              />
            </span>
            <span>Simulate 25% Proc (Skip Stage {{ step.stage + 1 }})</span>
          </label>

          <div class="text-right ql-num">
            <div
              class="text-[14px] font-bold"
              :class="
                step.isSkipped
                  ? 'line-through text-[#22c55e]'
                  : step.remainingStageTotalCost === 0
                    ? 'text-[#22c55e]'
                    : 'text-white'
              "
            >
              {{ formatNumber(step.isSkipped ? step.stageTotalCost : step.remainingStageTotalCost) }}
            </div>
            <div
              v-if="!step.isSkipped && step.remainingStageTotalCost < step.stageTotalCost"
              class="text-[11px] text-[#646b78] line-through leading-tight"
            >
              {{ formatNumber(step.stageTotalCost) }}
            </div>
          </div>
        </div>
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
              <th class="py-2 px-3 font-normal">Unit price</th>
              <th class="py-2 px-4 font-normal text-right">Cost</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#181b22] text-[13px]">
            <tr
              v-for="ing in step.ingredients"
              :key="`${step.stage}-${ing.id}`"
              class="hover:bg-[#14171e] transition-colors"
              :class="{ 'bg-[#0f1915]/40': !step.isSkipped && ing.remainingQuantity === 0 }"
            >
              <td class="py-2.5 px-4">
                <div class="flex items-center gap-3">
                  <div
                    class="ql-icon-frame w-8 h-8"
                    :class="getGradeFrameClass(ing.grade)"
                  >
                    <img
                      v-if="formatIconUrl(ing.icon) && !brokenIcons[`ing-${ing.id}`]"
                      :src="formatIconUrl(ing.icon)"
                      :alt="ing.name"
                      class="w-full h-full object-cover"
                      loading="lazy"
                      @error="brokenIcons[`ing-${ing.id}`] = true"
                    />
                    <span v-else class="text-[9px] font-bold text-[#8b92a0]">
                      {{ ing.name.slice(0, 2).toUpperCase() }}
                    </span>
                  </div>

                  <div class="min-w-0">
                    <div
                      class="text-[13px] font-medium leading-tight"
                      :class="[
                        getGradeTitleClass(ing.grade),
                        !step.isSkipped && ing.remainingQuantity === 0 ? 'line-through opacity-75' : ''
                      ]"
                    >
                      {{ ing.name }}
                    </div>
                    <div class="text-[11px] leading-tight mt-0.5 ql-num">
                      <span
                        v-if="!step.isSkipped && ing.remainingQuantity === 0"
                        class="text-[#22c55e] font-medium"
                      >
                        0 more needed ({{ ing.allocatedOwned }}/{{ ing.quantity }})
                      </span>
                      <span
                        v-else-if="!step.isSkipped && ing.allocatedOwned > 0"
                        class="text-[#eab308]"
                      >
                        {{ ing.remainingQuantity }} more needed ({{ ing.allocatedOwned }}/{{ ing.quantity }})
                      </span>
                      <span v-else class="text-[#7a818e]">
                        {{ ing.remainingQuantity }} more needed
                      </span>
                    </div>
                  </div>
                </div>
              </td>

              <td class="py-2.5 px-2.5 text-right whitespace-nowrap">
                <input
                  type="number"
                  min="0"
                  :max="ing.quantity"
                  step="1"
                  placeholder="0"
                  :value="getStageOwnedMaterial(step.stage, ing.id) || ''"
                  :aria-label="`Stage ${step.stage} Owned ${ing.name}`"
                  class="w-full bg-[#181b22] hover:bg-[#1d212a] focus:bg-[#1d212a] border rounded px-2 py-1 text-right text-[12px] ql-num focus:outline-none transition-colors"
                  :class="
                    getStageOwnedMaterial(step.stage, ing.id) > 0
                      ? 'border-[#22c55e]/50 text-[#22c55e] font-semibold'
                      : 'border-[#252934] focus:border-[#3b82f6] text-white placeholder-[#4b515d]'
                  "
                  @input="onOwnedInput(step.stage, ing.id, ing.quantity, $event)"
                />
              </td>

              <td class="py-2.5 px-3 text-right ql-num whitespace-nowrap">
                <div
                  class="text-[13px] font-semibold leading-tight"
                  :class="!step.isSkipped && ing.remainingQuantity === 0 ? 'text-[#22c55e]' : 'text-white'"
                >
                  {{ ing.remainingQuantity }}
                </div>
                <div class="text-[11px] text-[#646b78] leading-tight">
                  <template v-if="!step.isSkipped && ing.allocatedOwned > 0">
                    {{ ing.allocatedOwned }}/{{ ing.quantity }}
                  </template>
                  <template v-else>
                    ×{{ ing.quantity }}
                  </template>
                </div>
              </td>

              <td class="py-2.5 px-3 whitespace-nowrap">
                <div class="bg-[#1b1f27] border border-[#252934] rounded px-2.5 py-1 text-[12px] text-[#94a3b8] ql-num">
                  {{ ing.isPriceMissing ? '—' : Math.round(ing.unitPrice) }}
                </div>
                <div class="mt-1 text-[11px] leading-none flex items-center gap-1">
                  <template v-if="ing.method === 'Craft'">
                    <svg
                      class="w-3 h-3 text-[#38bdf8]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                    </svg>
                    <span class="text-[#38bdf8] font-medium">Craft</span>
                  </template>
                  <template v-else-if="ing.isNpcSource">
                    <span class="text-[#7a818e]">NPC</span>
                  </template>
                  <template v-else>
                    <span class="text-[#7a818e] ql-num">
                      {{ ing.listingsCount ? `${ing.listingsCount} listed` : 'Market' }}
                    </span>
                  </template>
                </div>
              </td>

              <td class="py-2.5 px-4 text-right ql-num whitespace-nowrap">
                <div
                  class="font-bold leading-tight"
                  :class="!step.isSkipped && ing.remainingQuantity === 0 ? 'text-[#22c55e]' : 'text-white'"
                >
                  {{ ing.isPriceMissing ? '—' : formatNumber(ing.remainingCost) }}
                </div>
                <div
                  v-if="!step.isSkipped && ing.allocatedOwned > 0 && !ing.isPriceMissing"
                  class="text-[11px] text-[#646b78] line-through leading-tight"
                >
                  {{ formatNumber(ing.totalCost) }}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
