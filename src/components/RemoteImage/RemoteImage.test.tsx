import React from 'react';
import renderer from 'react-test-renderer';
import { RemoteImage } from './RemoteImage';

describe('RemoteImage', () => {
  it('renders a View placeholder when uri is an empty string', () => {
    // When uri is empty, RemoteImage should render a View instead of Image to prevent React Native warnings
    const component = renderer.create(
      <RemoteImage uri="" style={{ width: 32, height: 32 }} />,
    );
    const tree = component.toJSON();

    expect(tree).not.toBeNull();
    // In react-test-renderer, React Native components render with their component names (View, Image)
    expect(tree?.type).toBe('View');
    expect(tree?.props.style).toEqual({ width: 32, height: 32 });
  });

  it('renders an Image with the given source uri when uri is valid', () => {
    const validUrl = 'https://example.com/logo.png';
    const component = renderer.create(
      <RemoteImage uri={validUrl} style={{ width: 32, height: 32 }} />,
    );
    const tree = component.toJSON();

    expect(tree).not.toBeNull();
    expect(tree?.type).toBe('Image');
    expect(tree?.props.source).toEqual({ uri: validUrl });
    expect(tree?.props.style).toEqual({ width: 32, height: 32 });
  });

  it('renders a View placeholder when uri is undefined or null', () => {
    const componentUndefined = renderer.create(<RemoteImage uri={undefined} />);
    const treeUndefined = componentUndefined.toJSON();
    expect(treeUndefined?.type).toBe('View');

    const componentNull = renderer.create(<RemoteImage uri={null} />);
    const treeNull = componentNull.toJSON();
    expect(treeNull?.type).toBe('View');
  });
});
