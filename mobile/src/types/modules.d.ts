declare module 'react-native-vector-icons/MaterialCommunityIcons' {
  import {ComponentType} from 'react';
  import {TextProps} from 'react-native';

  interface IconProps extends TextProps {
    name: string;
    size?: number;
    color?: string;
  }

  const Icon: ComponentType<IconProps>;
  export default Icon;
}

declare module 'react-native-video' {
  import React from 'react';

  export interface OnLoadData {
    [key: string]: any;
  }

  export interface OnErrorData {
    [key: string]: any;
  }

  class Video extends React.Component<any> {}
  export default Video;
}
