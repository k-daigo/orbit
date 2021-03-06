<template>
  <div>
    <div class="logo">
      <img src="/images/logo.png">
    </div>

    <!-- サイドバー -->
    <div class="menu" v-on:mouseover="onMenuMouseover" v-on:mouseleave="onMuneMouseleave">
      <div class="menuItem" v-show="meneItem">

        <!-- 衛星名 -->
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

        <!-- <hr class="menuSep">
        <a href="javascript:void(0)" class="white" v-on:click="onRealtimeClick">リアルタイム</a> -->
        <hr class="menuSep">
        <a href="javascript:void(0)" class="white" v-on:click="loadTle">TLE再取得</a>
      </div>
    </div>

    <!-- 表示中の衛星名と日時 -->
    <div class="sat-info">
      {{target}}
      &nbsp;&nbsp;&nbsp;&nbsp;
      {{clock}}
    </div>

    <!-- 地図 -->
    <div id="map" class="map"></div>
  </div>
</template>

<script>
"use strict";

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
      
      // 地図の拡大値による、時刻マーカーの表示間隔の設定
      markerConfig: {
        0: 1000, 1: 1000, 2: 500, 3: 300, 4: 200, 5: 100, 6: 50, 7: 30, 8: 30, 9: 5,
        10: 5, 11: 2, 12: 2, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 19: 1, 
        20: 1, 21: 1, 23: 1,
      },
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
        this.refresh();
      }, 1000)
    },

    // 定期更新
    refresh() {
      // 時刻更新
      this.clock = moment(new Date).format('YYYY/MM/DD HH:mm:ss');
      // 衛星の移動
      this.moveSatMarker();
    },

    // サイドメニューにマウスが乗ったらメニューを開く
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

    // サイドメニューからマウスが離れたらメニューを閉じる
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

    // TLE取得
    async loadTle() {
      this.orgTle = await this.getTleFromNorad();
      this.orbitMap = this.analyzeTle(this.orgTle);
      console.info(`TLE 取得完了`);
    },

    // NORADからTLEを取得する
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

    // 衛星の軌道をGoogleMapに描画
    viewSat() {
      const currentTle = new TinyOrbit.TLE(this.orbitMap[this.target].tle);
      this.satellite = new TinyOrbit.Satellite(currentTle);

      // 地図の初期設定
      var options = {
        center: new google.maps.LatLng(this.satellite.lat, this.satellite.lon),
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        zoom: 1,
        icon: null,
        streetViewControl: false,
        fullscreenControl: false,
      };
      this.gmap = new google.maps.Map( document.getElementById("map"), options );

      // 地図のズーム変更イベント
      const that = this;
      google.maps.event.addListener(this.gmap, 'zoom_changed', function() {
        that.onGmapZoomChanged();
      });
      // 表示中の緯度経度の変更イベント
      google.maps.event.addListener(this.gmap, 'bounds_changed', function() {
        that.saveBounds();
      });

      // 軌道の描画
      this.refreshOrbit();
    },

    // 地図の拡大縮小
    onGmapZoomChanged() {
      this.refreshOrbit();
    },

    // 衛星の現在位置を表示
    viewSatMarker() {
      let dt = new Date();
      this.satellite.setDate(dt);
      this.satellite.calcOrbit()

      var markerOptions = {
        map: this.gmap,
        position: new google.maps.LatLng(this.satellite.lat, this.satellite.lon),
      };

      if(this.satMarker != null) {
        this.satMarker.setMap(null);
      }
      this.satMarker = new google.maps.Marker(markerOptions);
    },

    // 衛星を現在位置に移動
    moveSatMarker() {
      let dt = new Date();
      this.satellite.setDate(dt);
      this.satellite.calcOrbit()
      this.satMarker.setPosition(new google.maps.LatLng(this.satellite.lat, this.satellite.lon));
    },

    // 軌道の線と時刻マーカーをクリア
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

    // 地図の表示範囲を保持
    saveBounds() {
      const bounds = this.gmap.getBounds();
      this.bounds = {
        mapNeLat: bounds.getNorthEast().lat(),
        mapNeLng: bounds.getNorthEast().lng(),
        mapSwLat: bounds.getSouthWest().lat(),
        mapSwLng: bounds.getSouthWest().lng(),
      }

      this.refreshOrbit();
    },

    // 指定の緯度経度が地図の表示範囲内か判定する
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

    // 軌道などを更新する
    refreshOrbit() {

      // 500ms後に更新する。更新前に次の更新要求が来た場合は、前回の更新予約をキャンセルする
      if(this.execProc != null) {
        clearTimeout(this.execProc);
      }
      this.execProc = setTimeout(this.viewOrbit, 500);
    },

    // 軌道などを再描画する
    viewOrbit() {
      this.execProc = null;
      console.debug(`getZoom=${this.gmap.getZoom()}`)

      // クリアしてから描画
      this.clearMaker();
      
      // 軌跡
      let dt = new Date();
      this.gmapMakers = [];
      const satPoints = [];

      //衛星の現在位置
      this.viewSatMarker();

      // 軌道と時刻マーカー
      const interval = this.markerConfig[this.gmap.getZoom()];
      for(let ii = 0; ii < 10000; ii++){
        this.satellite.setDate(dt);
        this.satellite.calcOrbit()

        // 地図の表示範囲内の場合にのみラベルを表示する
        let label = null;
        if(this.isSatInRange(this.satellite.lat, this.satellite.lon)) {
          label = {
            text: moment(dt).format('H:mm:ss'),
            color: '#000000',
            fontFamily: 'sans-serif',
            fontSize: '8px'
          };
        }
        const gLatLon = new google.maps.LatLng(this.satellite.lat, this.satellite.lon);
        satPoints.push(gLatLon);

        // 時刻マーカーの出力
        if(ii % interval == 0) {
          var markerOptions = {
            map: this.gmap,
            position: gLatLon,
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

    // TLEの解析
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

    // onRealtimeClick(){
    // },

    // メニュー・衛星名クリック
    selSatClick(satName) {
      this.target = satName;

      // ドロップダウンを非表示にする
      $("#selSatArea").removeClass("show");

      // 軌道を描画
      this.viewSat();
    },

    // メニュー開閉
    onSelSatClick() {
      document.getElementById("selSatArea").classList.toggle("show");
    },

    // メニュー・衛星名のサジェスト
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
  },

}
</script>
