import { h, inject } from 'vue';

function useLink(props) {
  const router = inject('router');
  console.log('router', router);
  function navigate() {
    router.push(props.to);
  }
  return {
    navigate,
  };
}

export const RouterLink = {
  name: 'RouterLink',
  props: {
    to: {
      type: [String, Object],
      required: true,
    },
  },
  setup(props, state) {
    const { slots } = state;
    const link = useLink(props);
    return () => {
      return h(
        'a',
        { onClick: link.navigate },
        slots.default && slots.default()
      );
    };
  },
};
