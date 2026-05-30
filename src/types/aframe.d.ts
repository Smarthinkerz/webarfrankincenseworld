import type * as React from 'react';

type AFrameElementProps = React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & Record<string, unknown>;

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'a-scene': AFrameElementProps;
      'a-assets': AFrameElementProps;
      'a-asset-item': AFrameElementProps;
      'a-camera': AFrameElementProps;
      'a-entity': AFrameElementProps;
      'a-video': AFrameElementProps;
    }
  }
}
