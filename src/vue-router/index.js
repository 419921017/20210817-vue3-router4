import { reactive, computed, shallowRef, unref } from 'vue';

import { createRouterMatcher } from './matcher';
export { createWebHashHistory } from './history/hash';
export { createWebHistory } from './history/html5';

import { RouterLink } from './routerLink';
import { RouterView } from './routerView';

export const START_LOCATION_NORMALIZED = {
  path: '/',
  // params: {},
  // query: {},
  matched: [],
};

function useCallback() {
  const handlers = [];
  function add(handler) {
    handlers.push(handler);
  }
  return {
    add,
    list: () => handlers,
  };
}

function extractChangeRecords(to, from) {
  const leavingRecords = [];
  const updatingRecords = [];
  const enteringRecords = [];

  const len = Math.max(to.matched.length, from.matched.length);

  for (let i = 0; i < len; i++) {
    const recordFrom = from.matched[i];
    if (recordFrom) {
      // from和to都有, 说明是更新
      if (to.matched.find((record) => record.path == recordFrom.path)) {
        updatingRecords.push(recordFrom);
      } else {
        leavingRecords.push(recordFrom);
      }
    }
    const recordTo = to.matched[i];
    if (recordTo) {
      // from里面没有, to里面有, 说明是进入
      if (!from.matched.find((record) => record.path === recordTo.path)) {
        enteringRecords.push(recordTo);
      }
    }
  }

  return [leavingRecords, updatingRecords, enteringRecords];
}

function extractComponentsGuards(matched, guardType, to, from) {
  const guards = [];
  for (const record of matched) {
    let rawComponent = record.components.default;
    const guard = rawComponent[guardType];
    guard && guards.push(guardToPromise(guard, to, from, record));
  }
  return guards;
}

function guardToPromise(guard, to, from, record) {
  return () =>
    new Promise((resolve) => {
      const next = () => resolve();
      let guardReturn = guard.call(record, to, from, next);
      // 如果不调用next, 最终也会自动调用next
      Promise.resolve(guardReturn).then(next);
    });
}

function runGuardQueue(guards) {
  // promise的组合函数
  return guards.reduce(
    (promise, guard) => promise.then(() => guard()),
    Promise.resolve()
  );
}

export function createRouter(options) {
  const routerHistory = options.history;
  const matcher = createRouterMatcher(options.routes);

  // console.log('routerHistory', routerHistory);
  // console.log('matcher', matcher);

  const currentRoute = shallowRef(START_LOCATION_NORMALIZED);
  // console.log('currentRoute', currentRoute);
  const beforeGuards = useCallback();
  const beforeResolveGuards = useCallback();
  const afterGuards = useCallback();

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
      // console.log('markAsReady', markAsReady);
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
   * 哪个组件是进入
   * 哪个组件是离开
   * 哪个组件是更新
   *
   * @param {*} to
   * @param {*} from
   */
  async function navigate(to, from) {
    const [leavingRecords, updatingRecords, enteringRecords] =
      extractChangeRecords(to, from);
    console.log(leavingRecords, updatingRecords, enteringRecords);

    let guards = extractComponentsGuards(
      leavingRecords.reverse(),
      'beforeRouteLeave',
      to,
      from
    );

    return runGuardQueue(guards)
      .then(() => {
        guards = [];
        for (const guard of beforeGuards.list()) {
          guards.push(guardToPromise(guard, to, from, guard));
        }
        return runGuardQueue(guards);
      })
      .then(() => {
        let guards = extractComponentsGuards(
          leavingRecords.reverse(),
          'beforeRouteUpdate',
          to,
          from
        );
        return runGuardQueue(guards);
      })
      .then(() => {
        guards = [];
        for (const record of to.matched) {
          if (record.beforeEnter) {
            guards.push(guardToPromise(record.beforeEnter, to, from, record));
          }
        }
        return runGuardQueue(guards);
      })
      .then(() => {
        let guards = extractComponentsGuards(
          leavingRecords.reverse(),
          'enteringRecords',
          to,
          from
        );
        return runGuardQueue(guards);
      });
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
    // NOTE: 路由拦截, beforeEach, beforeResolve, afterEach
    // beforeRouteEnter, beforeRouteUpdate, beforeRouteLeave

    /*
      a -> b
      a leave
      beforeEach
      b beforeEnter
      b beforeRouteEnter
      b resolve
      afterEach
    
    */

    navigate(targetLocation, from)
      .then(() => {
        return finalizeNavigation(targetLocation, from);
      })
      .then(() => {
        // 导航切换完毕后, 触发afterEach
        for (const guard of afterGuards.list()) {
          guard(to, from);
        }
      });

    // 如果是初始化我们还需注入listen, 更新currentRoute的值
    // 数据变化后可以重新渲染视图
    // console.log('currentRoute.value', currentRoute.value);
    markAsReady();
  }

  function push(to) {
    return pushWithRedirect(to);
  }

  // 路由的核心逻辑
  // 1. 页面切换
  // 2. 重新渲染
  const router = {
    push,
    beforeEach: beforeGuards.add,
    afterEach: afterGuards.add,
    beforeResolve: beforeResolveGuards.add,
    install(app) {
      const router = this;
      app.config.globalProperties.$router = router;

      Object.defineProperty(app.config.globalProperties, '$route', {
        enumerable: true,
        get: () => unref(currentRoute),
      });

      const reactiveRoute = {};

      for (let key in START_LOCATION_NORMALIZED) {
        reactiveRoute[key] = computed(() => currentRoute.value[key]);
      }

      app.provide('router', router);
      app.provide('route location', reactive(reactiveRoute));

      app.component('RouterLink', RouterLink);

      app.component('RouterView', RouterView);
      // app.component('RouterView', h('div', 'router-view'));

      if (currentRoute.value == START_LOCATION_NORMALIZED) {
        // 默认是初始化, 需要经过路由系统进行一次跳转, 发生一次匹配
        push(routerHistory.location);
      }
    },
  };
  return router;
}
