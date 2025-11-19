import { context } from "./context";
import { Fragment, NodeTypes, TEXT_ELEMENT, HookTypes } from "./constants";
import { Instance, VNode, EffectHook } from "./types";
import { insertInstance, removeInstance, setDomProps, updateDomProps } from "./dom";
import { createChildPath } from "./elements";

/**
 * 인스턴스 트리를 순회하여 모든 컴포넌트의 Effect cleanup을 실행합니다.
 */
const cleanupInstanceEffects = (instance: Instance | null): void => {
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
 *
 * @param parentDom - 부모 DOM 요소
 * @param instance - 이전 렌더링의 인스턴스
 * @param node - 새로운 VNode
 * @param path - 현재 노드의 고유 경로
 * @returns 업데이트되거나 새로 생성된 인스턴스
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
    // 간단한 인스턴스 생성 (텍스트 노드만 처리)
    if (node.type === TEXT_ELEMENT) {
      const newTextInstance: Instance = createTextInstance({ node, path });
      insertInstance(parentDom, newTextInstance);
      return newTextInstance;
    }

    // Fragment 처리
    if (node.type === Fragment) {
      const newFragmentInstance: Instance = createFragmentInstance({ node, path, parentDom });
      // Fragment는 DOM이 없으므로 insertInstance 호출하지 않음
      return newFragmentInstance;
    }

    // HTML 요소 처리
    if (typeof node.type === "string") {
      const newHTMLInstance: Instance = createHTMLInstance({ node, path });
      insertInstance(parentDom, newHTMLInstance);
      return newHTMLInstance;
    }

    // React 컴포넌트 처리
    if (typeof node.type === "function") {
      const newComponentInstance: Instance = createComponentInstance({ node, path, parentDom });
      // 컴포넌트는 DOM이 없으므로 insertInstance 호출하지 않음
      return newComponentInstance;
    }

    return null;
  }
  // 3. 타입이나 키가 다르면 기존 인스턴스를 제거하고 새로 마운트합니다.
  if (instance.node.type !== node.type || instance.node.key !== node.key) {
    // 컴포넌트 인스턴스인 경우 Effect cleanup 실행
    cleanupInstanceEffects(instance);
    // 기존 인스턴스 제거
    removeInstance(parentDom, instance);
    // 새 노드 마운트 (재귀 호출)
    return reconcile(parentDom, null, node, path);
  }

  // 4. 타입과 키가 같으면 인스턴스를 업데이트합니다. (update)
  // 이전 props 저장 (DOM 업데이트 비교용)
  const oldProps = instance.node.props;

  // 인스턴스의 기본 정보 업데이트
  instance.node = node;
  instance.path = path;

  // 텍스트 노드 업데이트
  if (node.type === TEXT_ELEMENT) {
    const textContent = node.props.nodeValue || "";
    if (instance.dom && instance.dom.textContent !== textContent) {
      instance.dom.textContent = textContent;
    }
    return instance;
  }

  // HTML 요소 업데이트
  if (typeof node.type === "string") {
    const { children, ...props } = node.props;
    if (instance.dom) {
      // DOM 속성 업데이트 (이전 props와 새 props 비교)
      updateDomProps(instance.dom as HTMLElement, oldProps, props);
      // 자식들 재조정
      instance.children = reconcileChildren(instance.dom as HTMLElement, instance.children, children || [], path);
    }
    return instance;
  }

  // Fragment 업데이트
  if (node.type === Fragment) {
    const { children } = node.props;
    // Fragment의 자식들을 부모 DOM에 재조정
    instance.children = reconcileChildren(parentDom, instance.children, children || [], path);
    return instance;
  }

  // React 컴포넌트 업데이트
  if (typeof node.type === "function") {
    context.hooks.componentStack.push(path);
    context.hooks.visited.add(path); // 방문된 컴포넌트 추가
    try {
      // 컴포넌트 함수 재실행
      const Component = node.type as React.ComponentType<Record<string, unknown>>;
      const childVNode = Component(node.props);

      // 기존 자식과 새 자식 재조정
      if (childVNode) {
        const childPath = createChildPath(path, null, 0, childVNode.type);
        const childInstance = reconcile(parentDom, instance.children[0] || null, childVNode, childPath);
        instance.children = childInstance ? [childInstance] : [];
      } else {
        // 자식이 없으면 기존 자식들 제거
        instance.children.forEach((child) => {
          if (child) removeInstance(parentDom, child);
        });
        instance.children = [];
      }
      return instance;
    } finally {
      context.hooks.componentStack.pop();
    }
  }

  return instance;
};

const createTextInstance = ({ node, path }: { node: VNode; path: string }) => {
  const textNode = document.createTextNode(node.props.nodeValue || "");
  const newInstance: Instance = {
    kind: NodeTypes.TEXT,
    dom: textNode,
    node,
    children: [],
    key: node.key,
    path,
  };
  return newInstance;
};

const createHTMLInstance = ({ node, path }: { node: VNode; path: string }) => {
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

  // children이 있으면 재귀적으로 마운트
  if (children && Array.isArray(children)) {
    const childInstances: Instance[] = [];
    // 컴포넌트 타입별로 0부터 시작하는 카운터
    const typeCounters = new Map<string | symbol | React.ComponentType, number>();

    children.forEach((child, index) => {
      if (child) {
        const effectiveKey = child.key;
        let pathIndex = index;

        // 컴포넌트인 경우 타입별 카운터 사용 (key가 없을 때만)
        if (effectiveKey === null && typeof child.type === "function") {
          const currentCount = typeCounters.get(child.type) || 0;
          pathIndex = currentCount;
          typeCounters.set(child.type, currentCount + 1);
        }

        const childPath = createChildPath(path, effectiveKey, pathIndex, child.type);
        const childInstance = reconcile(element, null, child, childPath);
        if (childInstance) {
          childInstances.push(childInstance);
        }
      }
    });
    newInstance.children = childInstances;
  }

  return newInstance;
};

const createFragmentInstance = ({ node, path, parentDom }: { node: VNode; path: string; parentDom: HTMLElement }) => {
  const newInstance: Instance = {
    kind: NodeTypes.FRAGMENT,
    dom: null, // Fragment는 DOM이 없음
    node,
    children: [],
    key: node.key,
    path,
  };

  // children이 있으면 재귀적으로 마운트 (Fragment 자식들을 parentDom에 직접 삽입)
  const { children } = node.props;
  if (children && Array.isArray(children)) {
    const childInstances: Instance[] = [];
    // 컴포넌트 타입별로 0부터 시작하는 카운터
    const typeCounters = new Map<string | symbol | React.ComponentType, number>();

    children.forEach((child, index) => {
      if (child) {
        const effectiveKey = child.key;
        let pathIndex = index;

        // 컴포넌트인 경우 타입별 카운터 사용 (key가 없을 때만)
        if (effectiveKey === null && typeof child.type === "function") {
          const currentCount = typeCounters.get(child.type) || 0;
          pathIndex = currentCount;
          typeCounters.set(child.type, currentCount + 1);
        }

        const childPath = createChildPath(path, effectiveKey, pathIndex, child.type);
        const childInstance = reconcile(parentDom, null, child, childPath); // parentDom에 직접 삽입
        if (childInstance) {
          childInstances.push(childInstance);
        }
      }
    });
    newInstance.children = childInstances;
  }

  return newInstance;
};

const reconcileChildren = (
  parentDom: HTMLElement,
  oldChildren: (Instance | null)[],
  newChildren: VNode[],
  parentPath: string,
): (Instance | null)[] => {
  const childInstances: (Instance | null)[] = [];
  const maxLength = Math.max(oldChildren.length, newChildren.length);

  // 컴포넌트 타입별로 0부터 시작하는 카운터
  const typeCounters = new Map<string | symbol | React.ComponentType, number>();

  for (let i = 0; i < maxLength; i++) {
    const oldChild = oldChildren[i];
    const newChild = newChildren[i];

    if (newChild) {
      const effectiveKey = newChild.key;
      let pathIndex = i;

      // 컴포넌트인 경우 타입별 카운터 사용 (key가 없을 때만)
      if (effectiveKey === null && typeof newChild.type === "function") {
        const currentCount = typeCounters.get(newChild.type) || 0;
        pathIndex = currentCount;
        typeCounters.set(newChild.type, currentCount + 1);
      }

      const childPath = createChildPath(parentPath, effectiveKey, pathIndex, newChild.type);
      const childInstance = reconcile(parentDom, oldChild, newChild, childPath);
      childInstances.push(childInstance);
    } else if (oldChild) {
      // 새 자식이 없으면 기존 자식 제거
      cleanupInstanceEffects(oldChild);
      removeInstance(parentDom, oldChild);
      childInstances.push(null);
    }
  }

  return childInstances.filter((child) => child !== null);
};

const createComponentInstance = ({ node, path, parentDom }: { node: VNode; path: string; parentDom: HTMLElement }) => {
  // 컴포넌트 스택에 현재 경로 추가 (훅 실행을 위해)
  context.hooks.componentStack.push(path);
  context.hooks.visited.add(path); // 방문된 컴포넌트 추가

  try {
    // 컴포넌트 함수 실행
    const Component = node.type as React.ComponentType<Record<string, unknown>>;
    const childVNode = Component(node.props);

    const newInstance: Instance = {
      kind: NodeTypes.COMPONENT,
      dom: null, // 컴포넌트 자체는 DOM이 없음
      node,
      children: [],
      key: node.key,
      path,
    };

    // 컴포넌트 실행 결과를 자식으로 마운트
    if (childVNode) {
      const childPath = createChildPath(path, null, 0, childVNode.type);
      const childInstance = reconcile(parentDom, null, childVNode, childPath);
      if (childInstance) {
        newInstance.children = [childInstance];
      }
    }

    return newInstance;
  } finally {
    // 컴포넌트 스택에서 제거 (훅 컨텍스트 정리)
    context.hooks.componentStack.pop();
  }
};
