<script setup>
import { onMounted, ref } from 'vue'

const homeUrl = ref('')
onMounted(() => { homeUrl.value = document.querySelector('meta[name="home-url"]')?.content || '' })
const links = [
  { to: '/', label: 'Home' },
]
</script>

<template>
  <header class="nav">
    <router-link to="/" class="brand">
      <span>UofT Tools</span>
    </router-link>
    <nav class="links">
      <a v-if="homeUrl" :href="homeUrl" class="navlink">Tiny Projects</a>
      <router-link
        v-for="l in links"
        :key="l.to"
        :to="l.to"
        class="navlink"
        :class="{ active: $route.path === l.to }"
      >{{ l.label }}</router-link>
    </nav>
  </header>
</template>

<style scoped>
.nav {
  flex-shrink: 0;
  background: var(--blue);
  color: #fff;
  padding: 0 1.25rem;
  height: 52px;
  display: flex;
  align-items: center;
  gap: 1.5rem;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: .5rem;
  color: #fff;
  text-decoration: none;
  font-weight: 700;
  font-size: 1rem;
  letter-spacing: .01em;
}
.links {
  display: flex;
  align-items: center;
  gap: .25rem;
  margin-left: auto;
}
.navlink {
  color: rgba(255, 255, 255, .72);
  text-decoration: none;
  font-size: .85rem;
  font-weight: 500;
  padding: .4rem .7rem;
  border-radius: 6px;
  transition: color .12s, background .12s;
}
.navlink:hover { color: #fff; background: rgba(255, 255, 255, .1); }
.navlink.active { color: #fff; background: rgba(255, 255, 255, .16); }
</style>
