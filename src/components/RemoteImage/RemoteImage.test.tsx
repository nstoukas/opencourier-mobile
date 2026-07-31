import React from 'react';
import renderer, {
  ReactTestRenderer,
  ReactTestRendererJSON,
} from 'react-test-renderer';
import { RemoteImage } from './RemoteImage';

// toJSON() is typed as "one node, or an array of them, or null" because a component may
// render a fragment. RemoteImage always returns exactly one root element, so we narrow to
// the single-node case here — and assert it, so this fails loudly if that ever changes
// rather than silently reading properties off an array.
const rootOf = (component: ReactTestRenderer): ReactTestRendererJSON => {
  const tree = component.toJSON();
  expect(tree).not.toBeNull();
  expect(Array.isArray(tree)).toBe(false);
  return tree as ReactTestRendererJSON;
};

describe('RemoteImage', () => {
  it('renders a View placeholder when uri is an empty string', () => {
    // When uri is empty, RemoteImage should render a View instead of Image to prevent React Native warnings
    const component = renderer.create(
      <RemoteImage uri="" style={{ width: 32, height: 32 }} />,
    );
    // In react-test-renderer, React Native components render with their component names (View, Image)
    const tree = rootOf(component);
    expect(tree.type).toBe('View');
    expect(tree.props.style).toEqual({ width: 32, height: 32 });
  });

  it('renders an Image with the given source uri when uri is valid', () => {
    const validUrl = 'https://example.com/logo.png';
    const component = renderer.create(
      <RemoteImage uri={validUrl} style={{ width: 32, height: 32 }} />,
    );
    const tree = rootOf(component);
    expect(tree.type).toBe('Image');
    expect(tree.props.source).toEqual({ uri: validUrl });
    expect(tree.props.style).toEqual({ width: 32, height: 32 });
  });

  it('renders a View placeholder when uri is undefined or null', () => {
    const componentUndefined = renderer.create(<RemoteImage uri={undefined} />);
    expect(rootOf(componentUndefined).type).toBe('View');

    const componentNull = renderer.create(<RemoteImage uri={null} />);
    expect(rootOf(componentNull).type).toBe('View');
  });
});
