import GObject from '@girs/node-gobject-2.0';

export function disposify<T extends GObject.Object>(target: T): T & Disposable {
  return Object.assign(target, { [Symbol.dispose]: () => target.unref() });
}
