<script setup>
import TheHeader from './components/TheHeader.vue'
import TheFooter from './components/TheFooter.vue'
import Breadcrumbs from './components/Breadcrumbs.vue'
import { useSeoHead } from './seo.js'

useSeoHead()
</script>

<template>
  <TheHeader />
  <Breadcrumbs />
  <main class="page">
    <router-view v-slot="{ Component }">
      <transition name="page" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </main>
  <TheFooter />
</template>

<style>
/* App shell: fixed header + footer, only the page area scrolls. */
#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
.page {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* Page transition */
.page-enter-active,
.page-leave-active {
  transition: opacity .18s ease, transform .18s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
