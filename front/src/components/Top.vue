<template>
  <div>
    <div class="logo">
      <img src="/images/logo.png">
    </div>

    <div class="menu" v-on:mouseover="onMenuMouseover" v-on:mouseleave="onMuneMouseleave">
      <div v-show="meneItem">
        リアルタイム
        <hr>
        TLE再取得
      </div>
    </div>

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

import anime from 'animejs'

export default {
  components: {
  },

  data () {
    return {
      orgTle: "",
      orbitMap: {},
      target: "ISS (ZARYA)",
      meneItem: false,
      saveMenuWidth: "",
    }
  },

  created () {
  },

  async mounted() {
    await this.loadTle();
    this.viewSat();
  },
  
  methods: {
    onMenuMouseover() {
      anime({
        targets: ['.menu'],
        width: '200px',
        delay: 0,
        direction: 'normal',
        easing: 'easeOutElastic(0.1, 0.9)',
        duration: 200,
        loop: false
      });
      this.meneItem = true;
    },

    onMuneMouseleave() {
      anime({
        targets: ['.menu'],
        width: '50px',
        delay: 0,
        direction: 'normal',
        easing: 'easeOutElastic(0.1, 0.9)',
        duration: 200,
        loop: false
      });
      this.meneItem = false;
    },

    onTleClick() {
      this.loadTle();
    },

    async loadTle() {
      this.orgTle = await this.getTleFromNorad();
      // console.debug(`this.orgTle=${this.orgTle}`);
      this.orbitMap = this.analyzeTle(this.orgTle);
    },

    async getTleFromNorad() {
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
      this.viewSat();
    },

    viewSat() {
      var myTLE = new orbits.TLE(this.orbitMap[this.target].tle);
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
        const line1List = line1.split(" ");

        // Line2
        const line2 = tleArr[linePos2];
        const line2List = line2.split(" ");
        data["catalogNo"] = line2List[1];
        data["omega"] = line2List[3];         // 昇交点赤経（Right Ascention of Ascending Node）
        data["i"] = line2List[2];             // 軌道傾斜角
        //data["a"] = 0;                      // 軌道長半径（Semi-major Axis）
        data["e"] = line2List[4];             // 離心率（Eccentricity）
        data["w"] = line2List[5];             // 近地点引数（Argument of Perigee）
        data["meanAnomaly"] = line2List[6];   // 平均近点角（Mean Anomaly）
        data["meanMotion"] = line2List[7];    // 平均運動（Mean Motion）

        // TLEデータを保持
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
