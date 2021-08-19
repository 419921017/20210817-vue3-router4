import { reactive, computed, shallowRef, unref, h } from 'vue';

import { createRouterMatcher } from './matcher';
export { createWebHashHistory } from './history/hash';
export { createWebHistory } from './history/html5';

import { RouterLink } from './routerLink';
// import { RouterView } from './routerView';

export const START_LOCATION_NORMALIZED = {
  path: '/',
  // params: {},
  // query: {},
  matched: [],
};

export function createRouter(options) {
  const routerHistory = options.history;
  const matcher = createRouterMatcher(options.routes);

  console.log('routerHistory', routerHistory);
  console.log('matcher', matcher);

  let currentRoute = shallowRef(START_LOCATION_NORMALIZED);
  // console.log('currentRoute', currentRoute);

  function resolve(to) {
    if (typeof to == 'string') {
      return matcher.resolve({ path: to });
    }
  }

  let ready;
  function markAsReady() {
    if (ready) return false;
    // 用来标记是否是第一次渲染, 是否渲染完毕
    ready = true;
    routerHistory.listen((to) => {
      const targetLocation = resolve(to);
      const from = currentRoute.value;
      finalizeNavigation(targetLocation, from, true);
      console.log('markAsReady', markAsReady);
    });
  }
  function finalizeNavigation(to, from, isReplace = false) {
    // 如果是第一次就用replace跳转
    if (from == START_LOCATION_NORMALIZED || isReplace) {
      routerHistory.replace(to.path);
    } else {
      routerHistory.push(to.path);
    }
    // 更新路径
    currentRoute.value = to;
  }
  /**
   * 通过路径匹配对应记录, 更新currentRoute
   *
   * @param {*} to
   */
  function pushWithRedirect(to) {
    console.log('to', to);
    const targetLocation = resolve(to);
    const from = currentRoute.value;
    console.log('targetLocation', targetLocation);
    console.log('from', from);
    // 路由拦截, beforeRouterEntry

    finalizeNavigation(targetLocation, from);
    // 如果是初始化我们还需注入listen, 更新currentRoute的值
    // 数据变化后可以重新渲染视图
    console.log('currentRoute.value', currentRoute.value);
    markAsReady();
  }

  function push(to) {
    return pushWithRedirect(to);
  }

  // 路由的核心逻辑
  // 1. 页面切换
  // 2. 重新渲染
  const router = {
    install(app) {
      app.config.globalProperties.$router = routerHistory;

      Object.defineProperty(app.config.globalProperties, '$route', {
        enumerable: true,
        get: () => unref(currentRoute),
      });

      const reactiveRoute = {};

      for (let key in START_LOCATION_NORMALIZED) {
        reactiveRoute[key] = computed(() => currentRoute.value[key]);
      }

      app.provide('router', routerHistory);
      app.provide('route location', reactive(reactiveRoute));

      app.component('RouterLink', RouterLink);

      // app.component('RouterView', RouterView);
      app.component('RouterView', h('div', 'router-view'));

      if (currentRoute.value == START_LOCATION_NORMALIZED) {
        // 默认是初始化, 需要经过路由系统进行一次跳转, 发生一次匹配
        push(routerHistory.location);
      }
    },
  };
  return router;
}
