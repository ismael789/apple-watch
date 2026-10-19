/* @flow */

import * as React from 'react';
import { Animated, View, Easing as RNEasing, StyleSheet } from 'react-native';
import Easing from 'easing-js';

import { distance2D, type Point3D } from '../math/utils';

type Props = {
  children: React.Node,
  initialPosition: Point3D,
  onPress: ?() => any,
};

type State = {
  visible: boolean,
  positionStyle: Object,
};

const NATURAL_SIZE = 200;
const OPACITY_RADIUS_MIN = 40;

export const isBubbleVisible = (position: Point3D, opacity: number = 1) =>
  Number.isFinite(position.x) &&
  Number.isFinite(position.y) &&
  Number.isFinite(position.z) &&
  position.z > 0 &&
  Number.isFinite(opacity) &&
  opacity > 0;

export const createStyleFromPosition = (
  position: Point3D,
  baseOpacity: number = 1,
) => {
  const { x, y, z } = position;
  const safeX = Number.isFinite(x) ? x : 0;
  const safeY = Number.isFinite(y) ? y : 0;
  const safeZ = Number.isFinite(z) ? Math.max(0, z) : 0;
  const radius = safeZ / 2;
  let opacity = Number.isFinite(baseOpacity)
    ? Math.max(0, Math.min(1, baseOpacity))
    : 0;
  if (radius < OPACITY_RADIUS_MIN) {
    opacity = Math.max(
      0,
      Easing.easeOutQuad(radius, -0.5, baseOpacity + 0.5, OPACITY_RADIUS_MIN),
    );
  }
  return {
    opacity,
    transform: [
      { translateX: safeX - NATURAL_SIZE / 2 },
      { translateY: safeY - NATURAL_SIZE / 2 },
      { scale: safeZ / NATURAL_SIZE },
    ],
  };
};

class Bubble extends React.Component<Props, State> {
  props: Props;

  opacity: number = 1;

  highlightOpacity: number = 1;

  highlighted: boolean = false;

  position: Point3D;

  highlightOpacityAnim: Animated.Value = new Animated.Value(1);

  constructor(props: Props) {
    super(props);
    this.position = props.initialPosition;
    this.state = {
      visible: isBubbleVisible(props.initialPosition),
      positionStyle: createStyleFromPosition(props.initialPosition),
    };
  }

  componentDidMount() {
    this.highlightOpacityAnim.addListener(({ value }) => {
      this.highlightOpacity = value;
      this.updateNative();
    });
  }

  componentWillUnmount() {
    this.highlightOpacityAnim.removeAllListeners();
  }

  setPosition(position: Point3D, opacity: number = 1) {
    this.position = position;
    this.opacity = opacity;
    this.setState({
      visible: isBubbleVisible(position, opacity),
      positionStyle: createStyleFromPosition(
        position,
        opacity * this.highlightOpacity,
      ),
    });
  }

  setHighlightOpacityTo = (value: number, duration: number = 250) => {
    if (duration > 0) {
      this.highlightOpacityAnim.stopAnimation(() => {
        Animated.timing(this.highlightOpacityAnim, {
          toValue: value,
          duration,
          easing: RNEasing.inOut(RNEasing.quad),
          useNativeDriver: false,
        }).start();
      });
    } else {
      this.highlightOpacityAnim.setValue(value);
    }
  };

  updateNative = () => {
    this.setState({
      positionStyle: createStyleFromPosition(
        this.position,
        this.opacity * this.highlightOpacity,
      ),
    });
  };

  isTouchWithinHitCircle = (x: number, y: number) => {
    const distance = distance2D(
      { x, y },
      {
        x: NATURAL_SIZE / 2,
        y: NATURAL_SIZE / 2,
      },
    );
    return distance < NATURAL_SIZE / 2;
  };

  onPress = () => {
    if (this.props.onPress) {
      this.props.onPress();
    }
  };

  startHighlight = () => {
    if (!this.highlighted) {
      this.highlighted = true;
      this.setHighlightOpacityTo(0.5);
      return true;
    }
    return false;
  };

  endHighlight = () => {
    if (this.highlighted) {
      this.highlighted = false;
      this.setHighlightOpacityTo(1);
      return true;
    }
    return false;
  };

  handleStartShouldSetResponder = ({ nativeEvent }: *) =>
    this.isTouchWithinHitCircle(nativeEvent.locationX, nativeEvent.locationY);

  handleResponderGrant = () => {
    this.startHighlight();
  };

  handleResponderMove = ({ nativeEvent }: *) => {
    const hit = this.isTouchWithinHitCircle(
      nativeEvent.locationX,
      nativeEvent.locationY,
    );
    if (!hit) {
      this.endHighlight();
    }
  };

  handleResponderRelease = () => {
    if (this.endHighlight()) {
      this.onPress();
    }
  };

  handleResponderTerminate = () => {
    this.endHighlight();
  };

  render() {
    if (!this.state.visible) {
      return null;
    }
    const { children, initialPosition, onPress, ...rest } = this.props;

    const styleList = [styles.circle, this.state.positionStyle];

    return (
      <View
        {...rest}
        style={styleList}
        onStartShouldSetResponder={this.handleStartShouldSetResponder}
        onResponderGrant={this.handleResponderGrant}
        onResponderMove={this.handleResponderMove}
        onResponderRelease={this.handleResponderRelease}
        onResponderTerminate={this.handleResponderTerminate}
      >
        {children}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  circle: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: NATURAL_SIZE,
    height: NATURAL_SIZE,
    borderRadius: NATURAL_SIZE / 2,
    overflow: 'hidden',
  },
});

export default Bubble;
