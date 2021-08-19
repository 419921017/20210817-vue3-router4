<template>
  <div class="home">

    <router-link to="/a">page A</router-link> /
    <router-link to="/b">page B</router-link>

    <router-view></router-view>
  </div>
</template>

<script>
// @ is an alias to /src

export default {
  name: "Home",
};
</script>
