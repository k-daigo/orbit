<template>
  <div>
    <div class="logo">
      <img src="/images/logo.png">
    </div>

    <div class="menu" v-on:mouseover="onMenuMouseover" v-on:mouseleave="onMuneMouseleave">
      <div class="menuItem" v-show="meneItem">
        <div class="dropdown">
          <a href="javascript:void(0)" class="white" v-on:click="onSelSatClick">{{target}}</a>
          <div id="selSatArea" class="dropdown-content">
            <input type="text" placeholder="衛星名" id="satSearchText" v-on:keyup="onSatSearchKeyup">
            <div id="selSatList" class="sal-sat-list">
              <a href="javascript:void(0)" v-for="(val, satName) in orbitMap" v-bind:key="satName"
                v-on:click="selSatClick(satName)">
                {{satName}}
              </a>
            </div>
          </div>
        </div>
        <br>

        <hr class="menuSep">
        <a href="javascript:void(0)" class="white" v-on:click="onRealtimeClick">リアルタイム</a>
        <hr class="menuSep">
        <a href="javascript:void(0)" class="white" v-on:click="loadTle">TLE再取得</a>
      </div>
    </div>

    <div class="sat-info">
      {{target}}
      &nbsp;&nbsp;&nbsp;&nbsp;
      {{clock}}
    </div>

    <div id="map" class="map"></div>
  </div>
</template>

<script>
import axios from 'axios';
axios.defaults.headers.common['Content-Type'] = 'application/x-www-form-urlencoded'
axios.defaults.headers.common['Access-Control-Allow-Origin'] = '*';
import anime from 'animejs'
import moment from 'moment'

// 衛星名のドロップダウン外のクリックでドロップダウンを非表示にする
$(document).on('click touchend', function(event) {
  if (!$(event.target).closest('.dropdown').length) {
    $("#selSatArea").removeClass("show");
  }
});

export default {
  components: {
  },

  data () {
    return {
      orgTle: "",
      orbitMap: {},
      target: "ISS (ZARYA)",
      clock: "",
      dtIntervalId: "",
      meneItem: false,
      saveMenuWidth: "",
      gmap: null,
      satellite: null,
      satMarker: null,
      gmapMakers: [],
      orbitLine: null,
      bounds: {},
      execProc: null,
    }
  },

  created () {
  },

  async mounted() {

    // TLEを取得
    await this.loadTle();

    // 衛星軌道を地図上に表示
    this.viewSat();

    // 初期表示はリアルタイム
    this.runRealtimeClock();
  },
  
  methods: {

    // 時刻のリアルタイム更新
    runRealtimeClock() {
      this.dtIntervalId = setInterval(() => {
        this.refreshClcok();
      }, 1000)
    },

    // 時刻更新
    refreshClcok() {
      this.clock = moment(new Date).format('YYYY/MM/DD HH:mm:ss');

      // 衛星の移動
      this.moveSatMarker();
      },

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

    // TLE取得
    async loadTle() {
      this.orgTle = await this.getTleFromNorad();
      this.orbitMap = this.analyzeTle(this.orgTle);
      console.info(`TLE 取得完了`);
    },

    async getTleFromNorad() {
      const that = this;
      return new Promise(resolve => {
        axios
          // .get('/NORAD/elements/active.txt')
          .get('/tle.txt')
          .then(function(res) {
            resolve(res.data);
          });
      });
    },

    onGetLonLatClick() {
      this.viewSat();
    },

    // 衛星の軌道をGoogleMapに描画
    viewSat() {
      var myTLE = new orbits.TLE(this.orbitMap[this.target].tle);
      var myOrbit = new orbits.Orbit(myTLE);
      var mapArea = new google.maps.Map(document.getElementById("map"));
      var mySat = new orbits.Satellite({ map: mapArea, tle: myTLE});
      var options = {
        center: mySat.position, // 地図の場所
        mapTypeId: google.maps.MapTypeId.ROADMAP,               // 地図の種類
        zoom: 1,                                                // 地図の縮尺
        icon: null,
        streetViewControl: false,
        fullscreenControl: false,
      };
      this.gmap = new google.maps.Map( document.getElementById("map"), options );

      // 地図のズーム変更イベント
      const that = this;
      google.maps.event.addListener(this.gmap, 'zoom_changed', function() {
        that.onGmapZoomChanged(this.gmap);
      });
      // 表示中の緯度経度の変更イベント
      google.maps.event.addListener(this.gmap, 'bounds_changed', function() {
        that.saveBounds();
      });

      this.satellite = new orbits.Satellite({ map: mapArea, tle: myTLE});

      // 軌道の再描画
      this.refreshOrbitTimer();
    },

    // 衛星の現在位置を表示
    viewSatMarker() {
      let dt = new Date();
      this.satellite.setDate(dt);
      this.satellite.refresh()

      var markerOptions = {
        map: this.gmap,
        position: this.satellite.position,
      };

      if(this.satMarker != null) {
        this.satMarker.setMap(null);
      }
      this.satMarker = new google.maps.Marker(markerOptions);
    },

    moveSatMarker() {
      let dt = new Date();
      this.satellite.setDate(dt);
      this.satellite.refresh()
      this.satMarker.setPosition(this.satellite.position);
    },

    clearMaker() {
      // 時刻マーカー
      this.gmapMakers.forEach(function (marker, idx) {
        marker.setMap(null);
      });
      // 軌道の線
      if(this.orbitLine != null){
        this.orbitLine.setMap(null);
      }
    },

    saveBounds() {
      const bounds = this.gmap.getBounds();
      this.bounds = {
        mapNeLat: bounds.getNorthEast().lat(),
        mapNeLng: bounds.getNorthEast().lng(),
        mapSwLat: bounds.getSouthWest().lat(),
        mapSwLng: bounds.getSouthWest().lng(),
      }
      // console.debug(`saveBounds=${JSON.stringify(this.bounds)}`)
      this.refreshOrbitTimer();
    },

    isSatInRange(lat, lng) {
      if(this.gmap == null) {
        return true;
      }

      // 緯度　画面表示の北と南の範囲内か？
      if(lat > this.bounds.mapNeLat || lat < this.bounds.mapSwLat) {
        return false;
      }

      // 経度　画面表示の西と東の範囲内か？
      if(lng < this.bounds.mapSwLng || lng > this.bounds.mapNeLng) {
        return false;
      }

      // console.debug(`ret true`)
      return true;
    },

    refreshOrbitTimer() {
      if(this.execProc != null) {
        clearTimeout(this.execProc);
      }
      this.execProc = setTimeout(this.refreshOrbit, 500);
    },

    refreshOrbit() {
      this.execProc = null;
      console.debug(`getZoom=${this.gmap.getZoom()}`)

      // クリアしてから描画
      this.clearMaker();

      const markerConfig = {
        0: {"c": 200, "i": 1000},
        1: {"c": 200, "i": 1000},
        2: {"c": 200, "i": 500},
        3: {"c": 400, "i": 300},
        4: {"c": 500, "i": 200},
        5: {"c": 900, "i": 100},
        6: {"c": 2000, "i": 50},
        7: {"c": 2000, "i": 30},
        8: {"c": 2000, "i": 30},
        9: {"c": 2000, "i": 5},
        10: {"c": 2000, "i": 5},
        11: {"c": 2000, "i": 2},
        12: {"c": 2000, "i": 2},
        13: {"c": 2000, "i": 1},
        14: {"c": 2000, "i": 1},
        15: {"c": 2000, "i": 1},
        16: {"c": 2000, "i": 1},
        17: {"c": 2000, "i": 1},
        18: {"c": 2000, "i": 1},
        19: {"c": 2000, "i": 1},
        20: {"c": 2000, "i": 1},
        21: {"c": 2000, "i": 1},
        23: {"c": 2000, "i": 1},
      }
      
      // 軌跡
      let dt = new Date();
      this.gmapMakers = [];
      const satPoints = [];

      //衛星の現在位置
      this.viewSatMarker();

      // 軌道と時刻マーカー
      const pointCount = markerConfig[this.gmap.getZoom()].c;
      const interval = markerConfig[this.gmap.getZoom()].i;
      for(let ii = 0; ii < 10000; ii++){
        this.satellite.setDate(dt);
        this.satellite.refresh()

        // 地図の表示範囲内の場合にのみラベルを表示する
        let label = null;
        if(this.isSatInRange(this.satellite.position.lat(), this.satellite.position.lng())) {
          label = {
            text: moment(dt).format('H:mm:ss'),
            color: '#000000',
            fontFamily: 'sans-serif',
            fontSize: '8px'
          };
        }

        satPoints.push(this.satellite.position);

        if(ii % interval == 0) {
          var markerOptions = {
            map: this.gmap,
            position: this.satellite.position,
            icon: "none",
            label: label,
          };
          this.gmapMakers.push(new google.maps.Marker(markerOptions));
        }

        // 次の軌跡は1秒後の位置
        dt.setSeconds(dt.getSeconds() + 1);
      }

      // 軌道の線と時刻マーカーの設定
      this.orbitLine = new google.maps.Polyline({
          path: satPoints,
          strokeColor: "#FF0000",
          strokeOpacity: 1.0,
          strokeWeight: 2,
          geodesic: true ,
        }
      );

      // 描画
      this.orbitLine.setMap(this.gmap);
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
    },

    onRealtimeClick(){
      
    },

    selSatClick(satName) {
      this.target = satName;

      // ドロップダウンを非表示にする
      $("#selSatArea").removeClass("show");

      // 軌道を描画
      this.viewSat();
    },

    onSelSatClick() {
      document.getElementById("selSatArea").classList.toggle("show");
    },

    onSatSearchKeyup() {
      const input = document.getElementById("satSearchText");
      const filter = input.value.toUpperCase();
      const div = document.getElementById("selSatArea");
      const a = div.getElementsByTagName("a");
      for (let i = 0; i < a.length; i++) {
        const txtValue = a[i].textContent || a[i].innerText;
        if (txtValue.toUpperCase().indexOf(filter) > -1) {
          a[i].style.display = "";
        } else {
          a[i].style.display = "none";
        }
      }
    },

    onGmapZoomChanged(gmap) {
      this.refreshOrbitTimer();
    },
  },

}
</script>
