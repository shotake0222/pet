declare namespace JSX {
  interface IntrinsicElements {
    'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      src?: string;
      'camera-controls'?: string | boolean;
      'auto-rotate'?: string | boolean;
      style?: React.CSSProperties;
    };
  }
}