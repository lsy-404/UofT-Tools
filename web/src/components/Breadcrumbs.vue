<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const crumb = computed(() => route.meta?.crumb || null)
</script>

<template>
  <nav v-if="crumb" class="crumbs" aria-label="Breadcrumb">
    <ol>
      <li><router-link to="/">Home</router-link></li>
      <li aria-current="page">{{ crumb }}</li>
    </ol>
  </nav>
</template>

<style scoped>
.crumbs { flex-shrink: 0; background: #fff; border-bottom: 1px solid var(--border); padding: .35rem 1.25rem; font-size: .75rem; color: var(--muted); }
.crumbs ol { list-style: none; display: flex; gap: .4rem; }
.crumbs li + li::before { content: '›'; margin-right: .4rem; opacity: .6; }
.crumbs a { color: var(--blue); text-decoration: none; }
.crumbs a:hover { text-decoration: underline; }
</style>
