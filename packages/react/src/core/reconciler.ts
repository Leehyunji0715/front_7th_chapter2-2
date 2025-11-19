import { context } from "./context";
import { Fragment, NodeTypes, TEXT_ELEMENT, HookTypes } from "./constants";
import { Instance, VNode, EffectHook } from "./types";
import { insertInstance, removeInstance, setDomProps, updateDomProps } from "./dom";
import { createChildPath } from "./elements";

/**
 * 인스턴스 트리를 순회하여 모든 컴포넌트의 Effect cleanup을 실행합니다.
 */
export const cleanupInstanceEffects = (instance: Instance | null): void => {
  if (!instance) {
    return;
  }

  // 컴포넌트 인스턴스인 경우 Effect cleanup 실행
  if (instance.kind === NodeTypes.COMPONENT) {
    const hooks = context.hooks.state.get(instance.path);
    if (hooks) {
      hooks.forEach((hook) => {
        if (hook.kind === HookTypes.EFFECT) {
          const effectHook = hook as EffectHook;
          if (effectHook.cleanup) {
            effectHook.cleanup();
          }
        }
      });
    }
  }

  // 자식들도 재귀적으로 cleanup
  if (instance.children) {
    for (const child of instance.children) {
      cleanupInstanceEffects(child);
    }
  }
};

/**
 * 이전 인스턴스와 새로운 VNode를 비교하여 DOM을 업데이트하는 재조정 과정을 수행합니다.
 */
export const reconcile = (
  parentDom: HTMLElement,
  instance: Instance | null,
  node: VNode | null,
  path: string,
): Instance | null => {
  // 1. 새 노드가 null이면 기존 인스턴스를 제거합니다. (unmount)
  if (node === null) {
    if (instance) {
      removeInstance(parentDom, instance);
    }
    return null;
  }

  // 2. 기존 인스턴스가 없으면 새 노드를 마운트합니다. (mount)
  if (!instance) {
    return mountNode(parentDom, node, path);
  }

  // 3. 타입이나 키가 다르면 기존 인스턴스를 제거하고 새로 마운트합니다.
  if (instance.node.type !== node.type || instance.node.key !== node.key) {
    cleanupInstanceEffects(instance);
    removeInstance(parentDom, instance);
    return reconcile(parentDom, null, node, path);
  }

  // 4. 타입과 키가 같으면 인스턴스를 업데이트합니다. (update)
  return updateNode(parentDom, instance, node, path);
};

// 새 노드를 마운트하는 함수
const mountNode = (parentDom: HTMLElement, node: VNode, path: string): Instance | null => {
  if (node.type === TEXT_ELEMENT) {
    const newInstance = createTextInstance(node, path);
    insertInstance(parentDom, newInstance);
    return newInstance;
  }

  if (node.type === Fragment) {
    return createFragmentInstance(parentDom, node, path);
  }

  if (typeof node.type === "string") {
    const newInstance = createHTMLInstance(parentDom, node, path);
    insertInstance(parentDom, newInstance);
    return newInstance;
  }

  if (typeof node.type === "function") {
    return createComponentInstance(parentDom, node, path);
  }

  return null;
};

// 기존 노드를 업데이트하는 함수
const updateNode = (parentDom: HTMLElement, instance: Instance, node: VNode, path: string): Instance => {
  const oldProps = instance.node.props;

  instance.node = node;
  instance.path = path;

  if (node.type === TEXT_ELEMENT) {
    const textContent = node.props.nodeValue || "";
    if (instance.dom && instance.dom.textContent !== textContent) {
      instance.dom.textContent = textContent;
    }
    return instance;
  }

  if (typeof node.type === "string") {
    const { children, ...props } = node.props;
    if (instance.dom) {
      updateDomProps(instance.dom as HTMLElement, oldProps, props);
      instance.children = reconcileChildren(instance.dom as HTMLElement, instance.children, children || [], path);
    }
    return instance;
  }

  if (node.type === Fragment) {
    const { children } = node.props;
    instance.children = reconcileChildren(parentDom, instance.children, children || [], path);
    return instance;
  }

  if (typeof node.type === "function") {
    return updateComponentInstance(parentDom, instance, node, path);
  }

  return instance;
};

// 인스턴스 생성 함수들
const createTextInstance = (node: VNode, path: string): Instance => {
  const textNode = document.createTextNode(node.props.nodeValue || "");
  return {
    kind: NodeTypes.TEXT,
    dom: textNode,
    node,
    children: [],
    key: node.key,
    path,
  };
};

const createHTMLInstance = (parentDom: HTMLElement, node: VNode, path: string): Instance => {
  const element = document.createElement(node.type as string);
  const { children, ...props } = node.props;
  setDomProps(element, props);

  const newInstance: Instance = {
    kind: NodeTypes.HOST,
    dom: element,
    node,
    children: [],
    key: node.key,
    path,
  };

  if (children && Array.isArray(children)) {
    newInstance.children = reconcileChildren(element, [], children, path);
  }

  return newInstance;
};

const createFragmentInstance = (parentDom: HTMLElement, node: VNode, path: string): Instance => {
  const newInstance: Instance = {
    kind: NodeTypes.FRAGMENT,
    dom: null,
    node,
    children: [],
    key: node.key,
    path,
  };

  const { children } = node.props;
  if (children && Array.isArray(children)) {
    newInstance.children = reconcileChildren(parentDom, [], children, path);
  }

  return newInstance;
};

const createComponentInstance = (parentDom: HTMLElement, node: VNode, path: string): Instance => {
  const newInstance: Instance = {
    kind: NodeTypes.COMPONENT,
    dom: null,
    node,
    children: [],
    key: node.key,
    path,
  };

  context.hooks.componentStack.push(path);
  context.hooks.visited.add(path);

  try {
    const Component = node.type as React.ComponentType<Record<string, unknown>>;
    const childVNode = Component(node.props);

    if (childVNode) {
      const childPath = createChildPath(path, null, 0, childVNode.type);
      const childInstance = reconcile(parentDom, null, childVNode, childPath);
      if (childInstance) {
        newInstance.children = [childInstance];
      }
    }

    return newInstance;
  } finally {
    context.hooks.componentStack.pop();
  }
};

const updateComponentInstance = (parentDom: HTMLElement, instance: Instance, node: VNode, path: string): Instance => {
  context.hooks.componentStack.push(path);
  context.hooks.visited.add(path);

  try {
    const Component = node.type as React.ComponentType<Record<string, unknown>>;
    const childVNode = Component(node.props);

    if (childVNode) {
      const childPath = createChildPath(path, null, 0, childVNode.type);
      const childInstance = reconcile(parentDom, instance.children[0] || null, childVNode, childPath);
      instance.children = childInstance ? [childInstance] : [];
    } else {
      instance.children.forEach((child) => {
        if (child) removeInstance(parentDom, child);
      });
      instance.children = [];
    }

    return instance;
  } finally {
    context.hooks.componentStack.pop();
  }
};

const reconcileChildren = (
  parentDom: HTMLElement,
  oldChildren: (Instance | null)[],
  newChildren: VNode[],
  parentPath: string,
): (Instance | null)[] => {
  const childInstances: (Instance | null)[] = [];
  const maxLength = Math.max(oldChildren.length, newChildren.length);
  const typeCounters = new Map<string | symbol | React.ComponentType, number>();

  for (let i = 0; i < maxLength; i++) {
    const oldChild = oldChildren[i];
    const newChild = newChildren[i];

    if (newChild) {
      const effectiveKey = newChild.key;
      let pathIndex = i;

      if (effectiveKey === null && typeof newChild.type === "function") {
        const currentCount = typeCounters.get(newChild.type) || 0;
        pathIndex = currentCount;
        typeCounters.set(newChild.type, currentCount + 1);
      }

      const childPath = createChildPath(parentPath, effectiveKey, pathIndex, newChild.type);
      const childInstance = reconcile(parentDom, oldChild, newChild, childPath);
      childInstances.push(childInstance);
    } else if (oldChild) {
      cleanupInstanceEffects(oldChild);
      removeInstance(parentDom, oldChild);
      childInstances.push(null);
    }
  }

  return childInstances.filter((child) => child !== null);
};
