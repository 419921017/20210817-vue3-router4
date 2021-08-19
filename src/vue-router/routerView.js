import { computed, h, inject, provide } from 'vue';

export const RouterView = {
  name: 'RouterView',
  // props: {
  //   name: {
  //     type: [String],
  //   },
  // },
  setup(props, state) {
    // 默认深度设置为0
    const depth = inject('depth', 0);
    const injectRoute = inject('route location');
    const matchedRouteRef = computed(() => injectRoute.matched[depth]);
    console.log('matchedRouteRef', matchedRouteRef);
    provide('depth', depth + 1);

    return () => {
      const matchRoute = matchedRouteRef.value;
      const viewComponent = matchRoute && matchRoute.components.default;

      if (!viewComponent) {
        return state.slots.default && state.slots.default();
      }

      return h(viewComponent);
    };
  },
};
