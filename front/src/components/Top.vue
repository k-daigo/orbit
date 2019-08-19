<template>
  <div>
    Top<br>
    <button v-on:click="onTleClick">TLEを取得</button><br><br>
    <input v-model="target"><br><br>
    <button v-on:click="onGetLonLatClick">現在の位置情報を表示</button><br><br>
    <div id="map"></div>
  </div>
</template>

<script>
import axios from 'axios';
axios.defaults.headers.common['Content-Type'] = 'application/x-www-form-urlencoded'
axios.defaults.headers.common['Access-Control-Allow-Origin'] = '*';

export default {
  components: {
  },

  data () {
    return {
      orgTle: "",
      orbitMap: {},
      target: "2019-052C",
    }
  },

  created () {
  },

  mounted() {
  },
  
  methods: {
    onTleClick() {
      const that = this;
      axios
        .get('/NORAD/elements/active.txt')
        .then(function(res) {
          that.orgTle = res.data;
          that.orbitMap = that.analyzeTle(that.orgTle);
          console.debug(`orbitMap=${that.orbitMap}`);
        });
    },

    onGetLonLatClick() {
      // console.debug(this.orbitMap[this.target])
      // console.debug(this.orbitMap[this.target].tle)

      const tle = "2019-052C               \n"
                + "1 44488U 19052C   19230.87818252 -.00000064  00000-0  00000-0 0  9992\n"
                + "2 44488  97.6079 304.2499 0022533 248.3835 111.4953 15.07272526   255"

      var myMap = new google.maps.Map(document.getElementById("map"));
      // var myTLE = new orbits.TLE(this.orbitMap[this.target].tle);
      var myTLE = new orbits.TLE(tle);
      var mySat = new orbits.Satellite({ map: myMap, tle: myTLE});
      console.debug(`lon=${mySat.longitude}, lat=${mySat.latitude}, alt=${mySat.altitude}`)
    },

    analyzeTle(tle) {
      const tleArr = tle.split(/\r\n|\n/);

      let pos = 0;
      const orbitMap = {};
      const data = {};
      while(true) {
        const linePos0 = pos;
        const linePos1 = pos+1;
        const linePos2 = pos+2;
        if(linePos2 >= tleArr.length){
          break;
        }

        // 衛星名
        const satName = tleArr[linePos0].trim();
        
        // Line1
        const line1 = tleArr[linePos1];
        console.debug(`line1=${line1}`);
        const line1List = line1.split(" ");

        // Line2
        const line2 = tleArr[linePos2];
        console.debug(`line2=${line2}`);
        const line2List = line2.split(" ");
        console.debug(`line2List=${line2List}`);
        data["catalogNo"] = line2List[1];
        data["omega"] = line2List[3];         // 昇交点赤経（Right Ascention of Ascending Node）
        data["i"] = line2List[2];             // 軌道傾斜角
        //data["a"] = 0;                      // 軌道長半径（Semi-major Axis）
        data["e"] = line2List[4];             // 離心率（Eccentricity）
        data["w"] = line2List[5];             // 近地点引数（Argument of Perigee）
        data["meanAnomaly"] = line2List[6];   // 平均近点角（Mean Anomaly）
        data["meanMotion"] = line2List[7];    // 平均運動（Mean Motion）

        console.debug(satName)
        console.debug(tleArr[linePos1])
        console.debug(tleArr[linePos2])
        // TLEデータを保持
        //orbitMap[satName] = data;
        orbitMap[satName] = {
            line1: tleArr[linePos1],
            line2: tleArr[linePos2],
            tle: `${tleArr[linePos0]}\n${tleArr[linePos1]}\n${tleArr[linePos2]}`
        };

        pos += 3;
      }
      return orbitMap
    }
  },
}
</script>
