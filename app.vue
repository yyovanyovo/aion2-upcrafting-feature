<script setup lang="ts">
import { onMounted } from 'vue'
import { useDragonChains } from '~/composables/useDragonChains'

const { isLoading, isLoaded, error, loadDragonData } = useDragonChains()

onMounted(() => {
  loadDragonData()
})
</script>

<template>
  <div class="min-h-screen bg-[#0a0b0e] text-white antialiased">
    <main class="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 pb-16">
      <CalculatorHeader />

      <div
        v-if="isLoading && !isLoaded"
        class="bg-[#111318] border border-[#1e222a] rounded-lg p-10 text-center space-y-2.5"
      >
        <div
          class="w-6 h-6 border-2 border-[#eab308] border-t-transparent rounded-full animate-spin mx-auto"
        />
        <p class="text-[13px] text-[#8b92a0]">Loading data...</p>
      </div>

      <div
        v-else-if="error"
        class="bg-[#111318] border border-red-500/30 rounded-lg p-6 text-center space-y-3"
      >
        <p class="text-[13px] text-red-400 font-medium">{{ error }}</p>
        <button
          type="button"
          class="px-3 py-1.5 rounded bg-[#181c24] border border-[#252934] text-xs font-medium text-white"
          @click="loadDragonData"
        >
          Retry
        </button>
      </div>

      <div v-else class="flex flex-col lg:flex-row items-start gap-4">
        <StageRangeSelector />

        <div class="flex-1 min-w-0 w-full space-y-3.5">
          <SummaryCards />
          <UpgradePipeline />
          <ShoppingList />
        </div>
      </div>
    </main>
  </div>
</template>
