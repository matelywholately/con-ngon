/**
 * A simplified street plan of Cầu Giấy, in real coordinates.
 *
 * This exists only for the web build. `expo-maps` ships no web
 * implementation, and every tile server is blocked from this project's build
 * environment, so a browser has no basemap to draw. Rather than show an empty
 * rectangle — or worse, an invented city — the web canvas draws these actual
 * streets, projected through the same Web Mercator maths the phone uses, so a
 * pin sits in the correct place relative to the roads around it.
 *
 * It is **schematic**: each road is a handful of points where the real thing
 * bends continuously, and only the arteries are here. It is meant to make a
 * design review legible, and to make a pin's position meaningful. It is not
 * meant to navigate by, which is what the Chỉ đường button is for.
 *
 * Cầu Giấy is the district proposed for the pilot: students, offices and
 * cheap eateries overlapping, which is exactly the overlap the product needs.
 */
import type { Coords } from './geo.ts';

export type RoadClass = 'artery' | 'street' | 'lane';

export type Road = {
  name: string;
  cls: RoadClass;
  path: readonly Coords[];
};

/** Roughly the middle of the district — the fixtures' fallback centre. */
export const CAU_GIAY_CENTRE: Coords = { lat: 21.0313, lng: 105.7902 };

/**
 * Sông Tô Lịch, which runs down the district's eastern edge. It is the one
 * feature that orients a Hanoian instantly, which is why it is worth the
 * handful of points.
 */
export const TO_LICH: readonly Coords[] = [
  { lat: 21.0475, lng: 105.7968 },
  { lat: 21.0430, lng: 105.7995 },
  { lat: 21.0378, lng: 105.8016 },
  { lat: 21.0322, lng: 105.8032 },
  { lat: 21.0268, lng: 105.8042 },
  { lat: 21.0208, lng: 105.8048 },
  { lat: 21.0155, lng: 105.8043 },
];

/** Công viên Cầu Giấy, the district's green square. */
export const CAU_GIAY_PARK: readonly Coords[] = [
  { lat: 21.0378, lng: 105.7862 },
  { lat: 21.0378, lng: 105.7896 },
  { lat: 21.0352, lng: 105.7896 },
  { lat: 21.0352, lng: 105.7862 },
];

/** The lake at Nghĩa Tân, small but a useful landmark in the north. */
export const NGHIA_TAN_WATER: readonly Coords[] = [
  { lat: 21.0442, lng: 105.7908 },
  { lat: 21.0442, lng: 105.7930 },
  { lat: 21.0428, lng: 105.7932 },
  { lat: 21.0426, lng: 105.7910 },
];

export const ROADS: readonly Road[] = [
  {
    name: 'Cầu Giấy – Xuân Thủy',
    cls: 'artery',
    path: [
      { lat: 21.0332, lng: 105.8020 },
      { lat: 21.0346, lng: 105.7960 },
      { lat: 21.0360, lng: 105.7895 },
      { lat: 21.0368, lng: 105.7830 },
      { lat: 21.0372, lng: 105.7782 },
    ],
  },
  {
    name: 'Phạm Văn Đồng',
    cls: 'artery',
    path: [
      { lat: 21.0520, lng: 105.7838 },
      { lat: 21.0468, lng: 105.7845 },
      { lat: 21.0412, lng: 105.7852 },
      { lat: 21.0372, lng: 105.7858 },
    ],
  },
  {
    name: 'Phạm Hùng',
    cls: 'artery',
    path: [
      { lat: 21.0398, lng: 105.7788 },
      { lat: 21.0340, lng: 105.7792 },
      { lat: 21.0282, lng: 105.7796 },
      { lat: 21.0222, lng: 105.7800 },
    ],
  },
  {
    name: 'Trần Duy Hưng',
    cls: 'artery',
    path: [
      { lat: 21.0322, lng: 105.8028 },
      { lat: 21.0272, lng: 105.7998 },
      { lat: 21.0220, lng: 105.7970 },
      { lat: 21.0168, lng: 105.7944 },
    ],
  },
  {
    name: 'Nguyễn Phong Sắc',
    cls: 'street',
    path: [
      { lat: 21.0468, lng: 105.7888 },
      { lat: 21.0428, lng: 105.7894 },
      { lat: 21.0398, lng: 105.7901 },
      { lat: 21.0362, lng: 105.7906 },
    ],
  },
  {
    name: 'Trần Thái Tông',
    cls: 'street',
    path: [
      { lat: 21.0362, lng: 105.7878 },
      { lat: 21.0330, lng: 105.7882 },
      { lat: 21.0305, lng: 105.7887 },
      { lat: 21.0282, lng: 105.7892 },
      { lat: 21.0262, lng: 105.7898 },
    ],
  },
  {
    name: 'Dịch Vọng Hậu',
    cls: 'street',
    path: [
      { lat: 21.0392, lng: 105.7818 },
      { lat: 21.0361, lng: 105.7823 },
      { lat: 21.0332, lng: 105.7828 },
      { lat: 21.0304, lng: 105.7834 },
    ],
  },
  {
    name: 'Trần Quốc Hoàn',
    cls: 'street',
    path: [
      { lat: 21.0448, lng: 105.7918 },
      { lat: 21.0421, lng: 105.7935 },
      { lat: 21.0398, lng: 105.7952 },
    ],
  },
  {
    name: 'Nguyễn Khánh Toàn',
    cls: 'street',
    path: [
      { lat: 21.0352, lng: 105.7978 },
      { lat: 21.0349, lng: 105.8004 },
      { lat: 21.0344, lng: 105.8030 },
    ],
  },
  {
    name: 'Hoàng Quốc Việt',
    cls: 'artery',
    path: [
      { lat: 21.0472, lng: 105.7822 },
      { lat: 21.0466, lng: 105.7882 },
      { lat: 21.0460, lng: 105.7942 },
      { lat: 21.0452, lng: 105.7990 },
    ],
  },
  {
    name: 'Nguyễn Văn Huyên',
    cls: 'street',
    path: [
      { lat: 21.0462, lng: 105.7938 },
      { lat: 21.0424, lng: 105.7948 },
      { lat: 21.0388, lng: 105.7958 },
      { lat: 21.0356, lng: 105.7966 },
    ],
  },
  {
    name: 'Chùa Hà',
    cls: 'lane',
    path: [
      { lat: 21.0380, lng: 105.7938 },
      { lat: 21.0358, lng: 105.7942 },
      { lat: 21.0336, lng: 105.7946 },
    ],
  },
  {
    name: 'Tô Hiệu',
    cls: 'lane',
    path: [
      { lat: 21.0432, lng: 105.7862 },
      { lat: 21.0430, lng: 105.7908 },
      { lat: 21.0428, lng: 105.7950 },
    ],
  },
  {
    name: 'Duy Tân',
    cls: 'lane',
    path: [
      { lat: 21.0338, lng: 105.7842 },
      { lat: 21.0312, lng: 105.7848 },
      { lat: 21.0288, lng: 105.7854 },
    ],
  },
  {
    name: 'Mai Dịch',
    cls: 'lane',
    path: [
      { lat: 21.0396, lng: 105.7794 },
      { lat: 21.0384, lng: 105.7832 },
      { lat: 21.0374, lng: 105.7868 },
    ],
  },
];

/** How wide each class draws, in screen pixels at zoom 15. */
export const ROAD_WIDTH: Readonly<Record<RoadClass, number>> = {
  artery: 7,
  street: 4.5,
  lane: 2.5,
};
