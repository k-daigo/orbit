<template>
  <div>
    Top<br>
    <button v-on:click="onTleClick">TLEを取得</button><br><br>
    <input v-model="target"><br><br>
    <button v-on:click="onGetLonLatClick">現在の位置情報を表示</button><br><br>
    <div id="map" class="map"></div>
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
      target: "ISS (ZARYA)",
    }
  },

  created () {
  },

  mounted() {
  },
  
  methods: {
    async onTleClick() {
      this.orgTle = await this.getTle();
      // console.debug(`this.orgTle=${this.orgTle}`);
      this.orbitMap = this.analyzeTle(this.orgTle);
    },

    async getTle() {
      const that = this;
      return new Promise(resolve => {
        axios
          // .get('/NORAD/elements/active.txt')
          .get('/tle.txt')
          .then(function(res) {
            console.debug(`getTle ret`);
            resolve(res.data);
          });
      });
    },

    onGetLonLatClick() {
      // console.debug(this.orbitMap[this.target])
      // console.debug(this.orbitMap[this.target].tle)

      // const tle = "CALSPHERE 1             \n"
      //           + "1 00900U 64063C   19235.95092944  .00000188  00000-0  19216-3 0  9999\n"
      //           + "2 00900  90.1498  23.6225 0025889 230.1045 248.0241 13.73264408729488"

      // var TLE_Array = orbits.util.parseTLE(this.orgTle);
    
      var myTLE = new orbits.TLE(this.orbitMap[this.target].tle);
      // var myTLE = new orbits.TLE(TLE_Array[0].text);
      var myOrbit = new orbits.Orbit(myTLE);
      var myMap = new google.maps.Map(document.getElementById("map"));
      var mySat = new orbits.Satellite({ map: myMap, tle: myTLE});
      console.debug(`111-3 mySat.position=${mySat.position}`)
      var options = {
        center: mySat.position, // 地図の場所
        mapTypeId: google.maps.MapTypeId.ROADMAP,               // 地図の種類
        zoom: 1                                                // 地図の縮尺
      };
      const gmap = new google.maps.Map( document.getElementById("map"), options );

      const calSat = new orbits.Satellite({ map: myMap, tle: myTLE});

      // 軌跡
      let dt = new Date();
      const points = [];
      for(let ii = 0; ii < 200; ii++){
        dt.setMinutes(dt.getMinutes() + 1);
        calSat.setDate(dt);
        calSat.refresh()
        // console.debug(`calSat.position=${calSat.position}`)
        points.push(calSat.position);
      }

      const area = new google.maps.Polyline({
          path: points,
          strokeColor: "#FF0000",
          strokeOpacity: 1.0,
          strokeWeight: 2,
          geodesic: true ,
        }
      );
      area.setMap(gmap);

      //マーカー
      var markerOptions = {
        map: gmap,
        position: mySat.position,
      };
      var marker = new google.maps.Marker(markerOptions);

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
        // console.debug(`line1=${line1}`);
        const line1List = line1.split(" ");

        // Line2
        const line2 = tleArr[linePos2];
        // console.debug(`line2=${line2}`);
        const line2List = line2.split(" ");
        // console.debug(`line2List=${line2List}`);
        data["catalogNo"] = line2List[1];
        data["omega"] = line2List[3];         // 昇交点赤経（Right Ascention of Ascending Node）
        data["i"] = line2List[2];             // 軌道傾斜角
        //data["a"] = 0;                      // 軌道長半径（Semi-major Axis）
        data["e"] = line2List[4];             // 離心率（Eccentricity）
        data["w"] = line2List[5];             // 近地点引数（Argument of Perigee）
        data["meanAnomaly"] = line2List[6];   // 平均近点角（Mean Anomaly）
        data["meanMotion"] = line2List[7];    // 平均運動（Mean Motion）

        // console.debug(satName)
        // console.debug(tleArr[linePos1])
        // console.debug(tleArr[linePos2])
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
