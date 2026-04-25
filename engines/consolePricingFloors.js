function getFamilyHardFloor(family = "") {
  if (family === "ps5_disc") return 390;
  if (family === "ps5_digital") return 315;
  if (family === "xbox_series_x") return 305;
  if (family === "xbox_series_s") return 165;
  if (family === "switch_oled") return 210;
  if (family === "switch_lite") return 115;
  if (family === "switch_v2") return 165;
  return 0;
}

function getFamilyLowBandFloor(family = "") {
  if (family === "ps5_disc") return 375;
  if (family === "ps5_digital") return 300;
  if (family === "xbox_series_x") return 290;
  if (family === "xbox_series_s") return 155;
  if (family === "switch_oled") return 195;
  if (family === "switch_lite") return 105;
  if (family === "switch_v2") return 150;
  return 0;
}

function getSwitchBucketHardFloor(bucket = "") {
  if (bucket === "switch_v2_confirmed") return 165;
  if (bucket === "switch_unknown_standard") return 146;
  if (bucket === "switch_v1_confirmed") return 138;
  return 0;
}

function getSwitchBucketLowBandFloor(bucket = "") {
  if (bucket === "switch_v2_confirmed") return 155;
  if (bucket === "switch_unknown_standard") return 138;
  if (bucket === "switch_v1_confirmed") return 128;
  return 0;
}

export {
  getFamilyHardFloor,
  getFamilyLowBandFloor,
  getSwitchBucketHardFloor,
  getSwitchBucketLowBandFloor,
};
