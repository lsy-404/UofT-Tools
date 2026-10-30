<template>
  <div class="container">
    <h1 class="page-title">Page not found</h1>
    <p class="msg">The page you are looking for does not exist. <router-link to="/">Return to the UofT Tools home page</router-link>.</p>
  </div>
</template>

<style scoped>
.container { max-width: 780px; width: 100%; margin: 2.25rem auto; padding: 0 1.25rem; }
.page-title { font-size: 1.5rem; font-weight: 700; color: var(--blue); margin-bottom: .75rem; }
.msg a { color: var(--blue); }
</style>
