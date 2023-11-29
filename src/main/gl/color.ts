import Color from "color"
import { vec4 } from "gl-matrix"

export const colorToVec4 = (color: Color): vec4 => {
  const rgb = color.rgb().array()
  return [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, color.alpha()]
}

export const averageColor = (hex: string[]): vec4 => {
  let x = 0, y = 0, z = 0;
  let alpha = 1;

  for(let i = 0; i < hex.length; i++) {
    const vec = colorToVec4(Color(hex[0]))
    x += vec[0]
    y += vec[1]
    z += vec[2]
    alpha = vec[3]
  }

  return [x / hex.length, y / hex.length, z / hex.length, alpha]
}
