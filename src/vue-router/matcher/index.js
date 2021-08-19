function normalizeRouteRecord(record) {
  const route = {
    path: record.path,
    record,
    parent: null,
    children: record.children || [],
    meta: record.meta || {},
    beforeEnter: record.beforeEnter,
    name: record.name,
    components: {
      default: record.component,
    },
  };
  return route;
}

function createRouteRecordMatcher(record, parent) {
  const matcher = {
    path: record.path,
    record,
    parent,
    children: record.children || [],
  };
  if (parent) {
    parent.children.push(matcher);
  }
  return matcher;
}

function createRouterMatcher(routes) {
  const matchers = [];
  // 动态添加路由
  function addRoute(route, parent) {
    let normalizeRecord = normalizeRouteRecord(route);
    if (parent) {
      normalizeRecord.path = parent.path + normalizeRecord.path;
    }

    const matcher = createRouteRecordMatcher(normalizeRecord, parent);

    if ('children' in normalizeRecord) {
      let children = normalizeRecord.children;
      children.forEach((route) => addRoute(route, matcher));
    }
    matchers.push(matcher);
  }
  routes.forEach((route) => addRoute(route, null));
  console.log('matchers', matchers);

  function resolve(location) {
    const matched = [];
    let path = location.path;
    let matcher = matchers.find((m) => m.path == path);
    while (matcher) {
      matched.unshift(matcher.record);
      matcher = matcher.parent;
    }
    return {
      path,
      matched,
    };
  }
  return {
    resolve,
    addRoute,
  };
}

export { createRouterMatcher };
