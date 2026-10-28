<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDragonChains, formatIconUrl } from '~/composables/useDragonChains'
import { useTransferCalculator } from '~/composables/useTransferCalculator'
import {
  DRAGON_STAGE_PREFIXES,
  type CurrentStageOption,
  type DragonStageNumber
} from '~/types/dragon'

const { activeChain, selectedRace, selectedSlot } = useDragonChains()
const {
  currentStage,
  targetStage,
  procSkips,
  skippableStages,
  skippedSteps,
  hasOwnedMaterials,
  setCurrentStage,
  setTargetStage,
  toggleProcSkip,
  resetProcSkips,
  resetOwnedMaterials
} = useTransferCalculator()

const brokenIcons = ref<Record<string, boolean>>({})

const activeGoalRecipe = computed(() => {
  return activeChain.value?.stages?.[targetStage.value] ?? activeChain.value?.stages?.[6] ?? null
})

const activeGoalIcon = computed(() => formatIconUrl(activeGoalRecipe.value?.icon))

const professionName = computed(() => {
  const cat = activeChain.value?.mainCategory || 'blacksmithing'
  return cat.charAt(0).toUpperCase() + cat.slice(1)
})

const masteryLevel = computed(() => {
  return activeChain.value?.stages?.[1]?.masteryLevel || 55
})

const currentStageName = computed(() => {
  if (currentStage.value === 0) {
    const precursor = activeChain.value?.stages?.[1]?.recipeInputItems?.[0]
    return precursor?.name || 'None (Craft Base)'
  }
  const prefixes = DRAGON_STAGE_PREFIXES[selectedRace.value]
  return (
    activeChain.value?.stages?.[currentStage.value]?.name ||
    `${prefixes[currentStage.value]}${selectedSlot.value}`
  )
})

const goalStageName = computed(() => {
  const prefixes = DRAGON_STAGE_PREFIXES[selectedRace.value]
  return (
    activeChain.value?.stages?.[targetStage.value]?.name ||
    `${prefixes[targetStage.value]}${selectedSlot.value}`
  )
})

const resetRange = () => {
  setCurrentStage(0)
  setTargetStage(6)
}
</script>

<template>
  <aside class="w-full lg:w-[270px] shrink-0 bg-[#111318] border border-[#1e222a] rounded-lg p-4 space-y-4">
    <div class="bg-[#0d0f14] border border-[#1e222a] rounded-lg p-3 flex items-center gap-3">
      <div class="ql-icon-frame grade-fabled w-11 h-11">
        <img
          v-if="activeGoalIcon && !brokenIcons['goal-box']"
          :src="activeGoalIcon"
          :alt="goalStageName"
          class="w-full h-full object-cover"
          @error="brokenIcons['goal-box'] = true"
        />
        <span v-else class="text-xs font-bold text-[#eab308]">
          {{ selectedSlot.slice(0, 2).toUpperCase() }}
        </span>
      </div>

      <div class="min-w-0 flex-1">
        <div class="text-[13px] font-semibold text-[#eab308] leading-tight truncate">
          {{ goalStageName }}
        </div>
        <div class="text-[11px] text-[#8b92a0] leading-tight mt-0.5 truncate">
          Professional Lv {{ masteryLevel }} · {{ professionName }}
        </div>
        <div class="text-[11px] text-[#646b78] leading-tight mt-0.5 ql-num">
          Stage {{ currentStage }} → Stage {{ targetStage }}
        </div>
      </div>
    </div>

    <div class="space-y-1.5">
      <div class="text-[12px] text-[#8b92a0]">
        Current stage
      </div>
      <div class="bg-[#181b22] border border-[#242934] rounded-md px-3 py-2 text-[12px] text-white font-medium truncate">
        {{ currentStage === 0 ? '0 — None (Craft Base)' : `${currentStage} — ${currentStageName}` }}
      </div>
      <div class="ql-segmented-bar w-full justify-between">
        <button
          v-for="s in ([0, 1, 2, 3, 4, 5] as CurrentStageOption[])"
          :key="s"
          type="button"
          class="ql-segmented-btn flex-1 justify-center ql-num"
          :class="{ active: currentStage === s }"
          @click="setCurrentStage(s)"
        >
          {{ s }}
        </button>
      </div>
    </div>

    <div class="space-y-1.5">
      <div class="text-[12px] text-[#8b92a0]">
        Goal stage
      </div>
      <div class="bg-[#181b22] border border-[#242934] rounded-md px-3 py-2 text-[12px] text-[#eab308] font-medium truncate">
        {{ targetStage }} — {{ goalStageName }}
      </div>
      <div class="ql-segmented-bar w-full justify-between">
        <button
          v-for="s in ([1, 2, 3, 4, 5, 6] as DragonStageNumber[])"
          :key="s"
          type="button"
          class="ql-segmented-btn flex-1 justify-center ql-num"
          :class="[
            targetStage === s ? 'active' : '',
            s <= currentStage ? 'opacity-40' : ''
          ]"
          @click="setTargetStage(s)"
        >
          {{ s }}
        </button>
      </div>
    </div>

    <div class="space-y-2 pt-1 border-t border-[#1e222a]">
      <div class="text-[12px] text-[#8b92a0]">
        Simulate 25% proc skips
      </div>

      <div class="space-y-1.5">
        <button
          v-for="evenStage in ([2, 4, 6] as const)"
          :key="evenStage"
          type="button"
          :disabled="!skippableStages[evenStage]"
          class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md border text-[12px] transition-colors"
          :class="
            !skippableStages[evenStage]
              ? 'bg-[#111318] border-[#1a1d24] text-[#4b515d] cursor-not-allowed'
              : procSkips[evenStage]
                ? 'bg-[#13261c] border-[#22c55e]/40 text-[#22c55e] font-medium'
                : 'bg-[#161920] border-[#242934] hover:bg-[#1c2029] text-[#d1d5db]'
          "
          @click="skippableStages[evenStage] && toggleProcSkip(evenStage)"
        >
          <span>Stage {{ evenStage - 1 }} → Skip Stage {{ evenStage }}</span>
          <span class="text-[11px] ql-num">
            {{ !skippableStages[evenStage] ? 'N/A' : procSkips[evenStage] ? 'Skipped' : '25%' }}
          </span>
        </button>
      </div>
    </div>

    <div class="space-y-2 pt-1">
      <div>
        <button
          type="button"
          class="bg-[#1b1f27] hover:bg-[#232833] border border-[#282d38] rounded-md px-3 py-1.5 text-[12px] font-semibold text-white transition-colors"
          @click="resetRange"
        >
          Reset stage range
        </button>
      </div>
      <div>
        <button
          type="button"
          :disabled="skippedSteps.length === 0"
          class="bg-[#1b1f27] hover:bg-[#232833] disabled:opacity-45 border border-[#282d38] rounded-md px-3 py-1.5 text-[12px] font-semibold text-white transition-colors"
          @click="resetProcSkips"
        >
          Clear simulated procs
        </button>
      </div>
      <div v-if="hasOwnedMaterials">
        <button
          type="button"
          class="bg-[#1b1f27] hover:bg-[#232833] border border-[#282d38] rounded-md px-3 py-1.5 text-[12px] font-semibold text-white transition-colors"
          @click="resetOwnedMaterials"
        >
          Clear owned materials
        </button>
      </div>
    </div>
  </aside>
</template>
