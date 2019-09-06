"use strict";

const TinyOrbit = {
    util: {}
};

TinyOrbit.ONEDAY_MS = 1000 * 60 * 60 * 24;      // 1日のミリ秒
TinyOrbit.JULIAN_DAY_DELTA = 2440587.5;         // ユリウス通日に変換する為の日数（4712年1月1日の正午（世界時）からの日数）
TinyOrbit.JULIAN_CENTURY = 36525;               // 1ユリウス世紀（36525日）

// 地球の赤道半径（a）（赤道面の半径）
TinyOrbit.EARTH_RADIUS = 6378.137;
// 地球の極半径（b）（地心から北極点、南極点までの半径）
TinyOrbit.EARTH_INNER_RADIUS = 6356.7523142;

// 2/3
TinyOrbit.TOTHRD = 0.66666667;
TinyOrbit.CK2 = 5.413080e-4;
TinyOrbit.CK4 = 0.62098875e-6;
TinyOrbit.E6A = 1.0e-6;
TinyOrbit.QOMS2T = 1.88027916e-9;
TinyOrbit.S = 1.01222928;
TinyOrbit.TORAD = Math.PI / 180;            // Radian変換
TinyOrbit.XJ3 = -0.253881e-5;
TinyOrbit.XKE = 0.743669161e-1;
TinyOrbit.XKMPER = TinyOrbit.EARTH_RADIUS; // 地球半径
// TinyOrbit.xflat = 0.00335281066; // WGS-84 flattening
// TinyOrbit.xminpday = 1440.0;
TinyOrbit.AE = 1.0;
// TinyOrbit.pi = Math.PI;
TinyOrbit.PIO2 = Math.PI / 2;
TinyOrbit.TWOPI = 2 * Math.PI;
// TinyOrbit.x3pio2 = 3 * TinyOrbit.PIO2;

/**
 * 指定日付のユリウス通日を返す
 * ※ユリウス通日（西暦 -4712年1月1日の正午（世界時）からの日数）
 */
TinyOrbit.util.conbJulianDay = function(date) {
    return (date.getTime() / TinyOrbit.ONEDAY_MS) + TinyOrbit.JULIAN_DAY_DELTA;
};

/**
 * GMST（Greenwich mean sidereal time）（グリニッジ平均恒星時）に変換する
 */
TinyOrbit.util.convGmst = function(date) {
    // ユリウス通日
    const julianDay = TinyOrbit.util.conbJulianDay(date);

    // ユリウス世紀数
    // J2000からの経過日数をユリウス世紀単位で測った時間をユリウス世紀数という
    // ユリウス年の基準は2000年1月1日正午 (JD 2451545.0) 。これをJ2000.0と表記する
    const ut1 = (julianDay - 2451545.0) / TinyOrbit.JULIAN_CENTURY;

    // GMST = 18h 41m 50.54841s + 8640184.812866s * UT1 + 0.093104s * UT1 ^ 2 - 0.0000062s * (UT1 ^ 3)
    // お決まりらしい
    let gmst = 67310.54841 + ((876600.0 * 3600 + 8640184.812866) * ut1) + (0.093104 * ut1 * ut1) - (0.0000062 * (ut1 * ut1 * ut1));
    gmst = (gmst * (Math.PI/180) / 240.0) % (Math.PI*2);
    gmst += (gmst < 0) ? Math.PI*2 : 0;

    return gmst;
};

/**
 * Satelliteクラス
 */
TinyOrbit.Satellite = function(tle) {
    this.orbit = null;
    this.date = null;
    this.orbit = new TinyOrbit.Orbit(tle);

    // 軌道の再計算
    this.calcOrbit();
};

/**
 * 日付をセットする
 */
TinyOrbit.Satellite.prototype.setDate = function(date) {
    this.date = date;
};

/**
 * 軌道を計算する
 */
TinyOrbit.Satellite.prototype.calcOrbit = function() {
    const latlon = this.orbit.calc(this.date);
    this.lat = latlon[0];
    this.lon = latlon[1];
};

/**
 * Initializes a TLE object containing parsed TLE
 * @class
 * @param {string} tleText - A TLE string of 3 lines
 */
TinyOrbit.TLE = function (tleText) {
    this.tleText = tleText;
    this.parse(this.tleText);
};

/**
 * TLEのパース（必要な項目だけ収集）
 */
TinyOrbit.TLE.prototype.parse = function (tleText) {
    const lines = tleText.split("\n");

    // Line1・この軌道要素の元期 (年のラスト2桁)
    this.epochYear = parseInt(lines[1].substring(18,20));
    this.epochYear += (this.epochYear < 57) ? 2000 : 1000;

    // Line1・元期 (その年の通日3桁、および該日における時刻を表す9桁の小数)
    this.epochDay = parseFloat(lines[1].substring(20,32));

    // Line1・B* (B STAR) 抗力項
    this.bstar = 0;
    const tmp = lines[1].substring(53,61).split(/[+-]/);
    if (tmp.length == 3) {
        this.bstar = -1 * parseFloat("."+tmp[1].trim()) * Math.pow(10,-parseInt(tmp[2]));
    } else {
        this.bstar = parseFloat("."+tmp[0].trim()) * Math.pow(10,-parseInt(tmp[1]));
    }

    // Line2・軌道傾斜角（Degreee）
    this.inclination = parseFloat(lines[2].substring(8,16));

    // Line2・昇交点の赤経（Degreee）
    this.rightAscension = parseFloat(lines[2].substring(17,25));

    // Line2・離心率
    this.eccentricity = parseFloat("."+lines[2].substring(26,33).trim());

    // Line2・近地点引数（Degree）
    this.argumentOfPerigee = parseFloat(lines[2].substring(34,42));

    // Line2・平均近点角（Degree）
    this.meanAnomaly = parseFloat(lines[2].substring(43,51));

    // Line2・平均運動 (回転/day）
    this.meanMotion = parseFloat(lines[2].substring(52,63));
};

/**
 * Takes a date instance and returns the different between it and TLE's epoch
 * 指定の日付とTLEのエポックとの差を分単位で返す
 * @param       {Date} date - A instance of Date
 * @returns     {int} delta time in millis
 */
TinyOrbit.TLE.prototype.dtime = function(date) {
    const a = TinyOrbit.util.conbJulianDay(date);
    const b = TinyOrbit.util.conbJulianDay(new Date(Date.UTC(this.epochYear, 0, 0, 0, 0, 0) + this.epochDay * 86400000));
    return (a - b) * 1440.0; // in minutes
};

/**
 * Takes orbit.TLE object and initialized the SGP4 model
 * SGP4で初期化する
 * 参考：https://www.celestrak.com/NORAD/documentation/spacetrk.pdf
 * 参考：https://ja.wikipedia.org/wiki/SGP4
 * @class
 * @param  {orbit.TLE} tleObj - An instance of TinyOrbit.TLE
 */
TinyOrbit.Orbit = function(tleObj) {
    this.tle = tleObj;
    // this.date = null;

    this.xinc = this.tle.inclination * TinyOrbit.TORAD;
    this.xnodeo = this.tle.rightAscension * TinyOrbit.TORAD;
    this.eo = this.tle.eccentricity;
    this.omegao = this.tle.argumentOfPerigee * TinyOrbit.TORAD;

    // degreeである平均近点角（Mean Anomaly）をradianに変換
    this.xmo = this.tle.meanAnomaly * TinyOrbit.TORAD;

    this.xno = this.tle.meanMotion * TinyOrbit.TWOPI / 1440.0;
    this.bstar = this.tle.bstar;

    // Spacetrack Report No.3 ここから

    // recover orignal mean motion (xnodp) and semimajor axis (adop)
    // 元の平均運動（xnodp）と半長軸（adop）を復元する
    const a1 = Math.pow(TinyOrbit.XKE / this.xno, TinyOrbit.TOTHRD);
    this.cosio = Math.cos(this.xinc);
    const theta2 = this.cosio * this.cosio;
    this.x3thm1 = 3.0 * theta2 - 1;
    const eosq = this.eo * this.eo;
    const betao2= 1.0 - eosq;
    const betao = Math.sqrt(betao2);
    const del1 = 1.5 * TinyOrbit.CK2 * this.x3thm1 / (a1*a1 * betao*betao2);
    const ao = a1 * (1 - del1 * (0.5 * TinyOrbit.TOTHRD + del1 * (1 + 134 / 81 * del1)));
    const delo = 1.5 * TinyOrbit.CK2 * this.x3thm1 / (ao * ao * betao * betao2);
    this.xnodp = this.xno / (1.0 + delo);      // 平均運動
    this.aodp = ao / (1.0 - delo);             // 軌道長半径

    // initialization
    // for perigee less than 220 kilometers, the isimp flag is set and
    // the equations are truncated to linear variation in sqrt a and
    // quadratic variation in mean anomaly.also, the c3 term, the
    // delta omega term, and the delta m term are dropped.
    this.isimp = 0;
    if ((this.aodp * (1.0 - this.eo) / TinyOrbit.AE) < (220.0 / TinyOrbit.XKMPER + TinyOrbit.AE)) {
        this.isimp = 1;
    }

    let s4 = TinyOrbit.S;
    let qoms24 = TinyOrbit.QOMS2T;
    const perige = (this.aodp * (1.0 - this.eo) - TinyOrbit.AE) * TinyOrbit.XKMPER;
    if (perige < 156.0){
        s4 = perige - 78.0;
        if (perige > 98.0){
            qoms24 = ((120.0 - s4) * TinyOrbit.AE / TinyOrbit.XKMPER)**4;
            s4 = s4 / TinyOrbit.XKMPER + TinyOrbit.AE;
        } else {
            s4 = 20.0;
        }
    }
    const pinvsq = 1.0 / (this.aodp * this.aodp * betao2 * betao2);
    const tsi = 1.0 / (this.aodp - s4);
    this.eta = this.aodp * this.eo * tsi;
    const etasq = this.eta * this.eta;
    const eeta = this.eo * this.eta;
    const psisq = Math.abs(1.0 - etasq);
    const coef = qoms24 * tsi**4;
    const coef1 = coef / psisq**3.5;

    const c2 = coef1 * this.xnodp * (this.aodp * (1.0 + 1.5 * etasq + eeta * (4.0 + etasq))
        + 0.75 * TinyOrbit.CK2 * tsi / psisq * this.x3thm1 * (8.0 + 3.0 * etasq * (8.0 + etasq)));
    this.c1 = this.bstar * c2;
    this.sinio = Math.sin(this.xinc);
    const a3ovk2 = -TinyOrbit.XJ3 / TinyOrbit.CK2 * TinyOrbit.AE**3;
    const c3 = coef * tsi * a3ovk2 * this.xnodp * TinyOrbit.AE * this.sinio / this.eo;
    this.x1mth2 = 1.0 - theta2;
    this.c4 = 2.0 * this.xnodp * coef1 * this.aodp * betao2 * (this.eta * (2.0 + 0.5 * etasq) + this.eo * (0.5 + 2.0 * etasq)
        - 2.0 * TinyOrbit.CK2 * tsi / (this.aodp * psisq) * (-3.0 * this.x3thm1 * (1.0 - 2.0 * eeta + etasq * (1.5 - 0.5 * eeta))
        + 0.75 * this.x1mth2 * (2.0 * etasq - eeta * (1.0 + etasq)) * Math.cos((2.0 * this.omegao))));
    this.c5 = 2.0 * coef1 * this.aodp * betao2 * (1.0 + 2.75 * (etasq + eeta) + eeta * etasq);

    const theta4 = theta2 * theta2;
    const temp1 = 3.0 * TinyOrbit.CK2 * pinvsq * this.xnodp;
    const temp2 = temp1 * TinyOrbit.CK2 * pinvsq;
    const temp3 = 1.25 * TinyOrbit.CK4 * pinvsq * pinvsq * this.xnodp;
    this.xmdot = this.xnodp + 0.5 * temp1 * betao * this.x3thm1 + 0.0625 * temp2 * betao * (13.0 - 78.0 * theta2 + 137.0 * theta4);
    const x1m5th = 1.0 - 5.0 * theta2;
    this.omgdot = -0.5 * temp1 * x1m5th + 0.0625 * temp2 * (7.0 - 114.0 * theta2 + 395.0 * theta4) + temp3 * (3.0 - 36.0 * theta2 + 49.0 * theta4);
    const xhdot1 = -temp1 * this.cosio;
    this.xnodot = xhdot1 + (0.5 * temp2 * (4.0 - 19.0 * theta2) + 2.0 * temp3 * (3.0 - 7.0 * theta2)) * this.cosio;
    this.omgcof = this.bstar * c3 * Math.cos(this.omegao);
    this.xmcof = -TinyOrbit.TOTHRD * coef * this.bstar * TinyOrbit.AE / eeta;
    this.xnodcf = 3.5 * betao2 * xhdot1 * this.c1;
    this.t2cof = 1.5 * this.c1;
    this.xlcof = 0.125 * a3ovk2 * this.sinio * (3.0 + 5.0 * this.cosio) / (1.0 + this.cosio);
    this.aycof = 0.25 * a3ovk2 * this.sinio;
    this.delmo = (1.0 + this.eta * Math.cos(this.xmo))**3;
    this.sinmo = Math.sin(this.xmo);
    this.x7thm1 = 7.0 * theta2 - 1.0;

    if (this.isimp != 1){
        const c1sq = this.c1 * this.c1;
        this.d2 = 4.0 * this.aodp * tsi * c1sq;
        const temp = this.d2 * tsi * this.c1 / 3.0;
        this.d3 = (17.0 * this.aodp + s4) * temp;
        this.d4 = 0.5 * temp * this.aodp * tsi * (221.0 * this.aodp + 31.0 * s4) * this.c1;
        this.t3cof = this.d2 + 2.0 * c1sq;
        this.t4cof = 0.25 * (3.0 * this.d3 + this.c1 * (12.0 * this.d2 + 10.0 * c1sq));
        this.t5cof = 0.2 * (3.0 * this.d4 + 12.0 * this.c1 * this.d3 + 6.0 * this.d2 * this.d2 + 15.0 * c1sq * (2.0 * this.d2 + c1sq));
    }
    this.isimp = 0
};

/**
 * 指定日付の緯度経度を計算する
 * 「Spacetrack Report No.3」のSGP4の記載の内、日時によって値が変動する処理を計算する
 */
TinyOrbit.Orbit.prototype.calc = function(inDate) {
    const date = (inDate === null) ? new Date() : inDate;

    // 日付とTLEのエポックとの差を分単位で取得する
    const tsince = this.tle.dtime(date);

    // update for secular gravity and atmospheric drag
    // 平均近点角(のRadian) + (xxxx + エポックとの差)
    const xmdf = this.xmo + this.xmdot * tsince;
    const omgadf = this.omegao + this.omgdot * tsince;
    const xnoddf = this.xnodeo + this.xnodot * tsince;
    let omega = omgadf;
    let xmp = xmdf;
    const tsq = tsince * tsince;
    const xnode = xnoddf + this.xnodcf * tsq;
    let tempa= 1.0 - this.c1 * tsince;
    let tempe = this.bstar * this.c4 * tsince;
    let templ = this.t2cof * tsq;

    let temp;
    if (this.isimp != 1){
        const delomg = this.omgcof * tsince;
        const delm = this.xmcof * (Math.pow((1.0 + this.eta * Math.cos(xmdf)),3) - this.delmo);
        temp = delomg + delm;
        xmp = xmdf + temp;
        omega = omgadf - temp;
        const tcube = tsq * tsince;
        const tfour = tsince * tcube;
        tempa = tempa - this.d2 * tsq - this.d3 * tcube - this.d4 * tfour;
        tempe = tempe + this.bstar * this.c5 * (Math.sin(xmp) - this.sinmo);
        templ = templ + this.t3cof * tcube + tfour * (this.t4cof + tsince * this.t5cof);
    }

    // 軌道長半径を
    let a = this.aodp * (tempa**2);
    // 離心率
    const e = this.eo - tempe;
    const xl = xmp + omega + xnode + this.xnodp * templ;
    const beta = Math.sqrt(1.0 - e*e);
    const xn = TinyOrbit.XKE / Math.pow(a,1.5);

    // long period periodics
    // 長期間の定期刊行物
    const axn = e * Math.cos(omega);
    temp = 1.0/(a * beta * beta);
    const xll = temp * this.xlcof * axn;
    const aynl = temp * this.aycof;
    const xlt = xl + xll;
    const ayn = e * Math.sin(omega) + aynl;

    // solve keplers equation
    // ケプラー方程式を解く
    const capu = (xlt-xnode)%(2.0*Math.PI);
    let temp2 = capu;
    let temp3, temp4, temp5, temp6;
    let sinepw, cosepw;
    for (let i=1; i<=10; i++){
        sinepw = Math.sin(temp2);
        cosepw = Math.cos(temp2);
        temp3 = axn * sinepw;
        temp4 = ayn * cosepw;
        temp5 = axn * cosepw;
        temp6 = ayn * sinepw;
        const epw = (capu - temp4 + temp3 - temp2) / (1.0 - temp5 - temp6) + temp2;
        if (Math.abs(epw - temp2) <= TinyOrbit.E6A){
            break;
        }
        temp2 = epw;
    }
    
    // short period preliminary quantities
    // 短期準備数量
    const ecose = temp5 + temp6;
    const esine = temp3 - temp4;
    const elsq = axn * axn + ayn * ayn;
    temp = 1.0 - elsq;
    const pl = a * temp;
    const r = a * (1.0 - ecose);
    let temp1 = 1.0/r;
    const rdot = TinyOrbit.XKE * Math.sqrt(a) * esine * temp1;
    const rfdot = TinyOrbit.XKE * Math.sqrt(pl) * temp1;
    temp2 = a * temp1;
    const betal = Math.sqrt(temp);
    temp3 = 1.0/(1.0 + betal);
    const cosu = temp2 * (cosepw - axn + ayn * esine * temp3);
    const sinu = temp2 * (sinepw - ayn - axn * esine * temp3);
    let u = Math.atan2(sinu,cosu);
    u += (u < 0) ? 2 * Math.PI : 0;
    const sin2u = 2.0 * sinu * cosu;
    const cos2u = 2.0 * cosu * cosu - 1.0;
    temp = 1.0/pl;
    temp1 = TinyOrbit.CK2 * temp;
    temp2 = temp1 * temp;

    // update for short periodics
    // 短周期の更新
    const rk = r*(1.0 - 1.5 * temp2 * betal * this.x3thm1) + 0.5 * temp1 * this.x1mth2 * cos2u;
    const uk = u-0.25 * temp2 * this.x7thm1 * sin2u;
    const xnodek = xnode + 1.5 * temp2 * this.cosio * sin2u;
    const xinck = this.xinc + 1.5 * temp2 * this.cosio * this.sinio * cos2u;
    const rdotk = rdot - xn * temp1 * this.x1mth2 * sin2u;
    const rfdotk = rfdot + xn * temp1 * (this.x1mth2 * cos2u + 1.5 * this.x3thm1);

    // orientation vectors
    // 方向ベクトル
    const sinuk = Math.sin(uk);
    const cosuk = Math.cos(uk);
    const sinik = Math.sin(xinck);
    const cosik = Math.cos(xinck);
    const sinnok = Math.sin(xnodek);
    const cosnok = Math.cos(xnodek);
    const xmx = -sinnok * cosik;
    const xmy = cosnok * cosik;
    const ux = xmx * sinuk + cosnok * cosuk;
    const uy = xmy * sinuk + sinnok * cosuk;
    const uz = sinik * sinuk;
    const vx = xmx * cosuk - cosnok * sinuk;
    const vy = xmy * cosuk - sinnok * sinuk;
    const vz = sinik * cosuk;

    // position and velocity in km
    // 位置と速度
    this.x = rk * ux;
    this.y = rk * uy;
    this.z = rk * uz;
    this.xdot = rdotk * ux + rfdotk * vx;
    this.ydot = rdotk * uy + rfdotk * vy;
    this.zdot = rdotk * uz + rfdotk * vz;

    // Spacetrack Report No.3 はここまで

    // kmに変換
    this.x *= TinyOrbit.XKMPER;
    this.y *= TinyOrbit.XKMPER;
    this.z *= TinyOrbit.XKMPER;
    this.xdot *= TinyOrbit.XKMPER;
    this.ydot *= TinyOrbit.XKMPER;
    this.zdot *= TinyOrbit.XKMPER;

    // 緯度、経度
    // 参考）http://www.celestrak.com/columns/v02n03/

    // 
    const R = Math.sqrt(this.x * this.x + this.y * this.y);

    // 地球の扁平率（f）
    const f = (TinyOrbit.EARTH_RADIUS - TinyOrbit.EARTH_INNER_RADIUS) / TinyOrbit.EARTH_RADIUS;

    // グリニッジ平均恒星時（θ）
    const gmst = TinyOrbit.util.convGmst(date);

    // 緯度経度
    let lngRad = Math.atan2(this.y, this.x) - gmst;
    let latRad = Math.atan2(this.z, R);

    // 
    const e2 = (2 * f) - (f ** 2);

    // 衛星のサブポイントの測地緯度を計算（n回ループして近似値を取る）
    for (let ii = 0; ii < 20; ii++) {
        const C = 1 / Math.sqrt(1 - e2 * (Math.sin(latRad)**2));
        latRad = Math.atan2(this.z + (TinyOrbit.EARTH_INNER_RADIUS * C * e2 * Math.sin(latRad)), R);
    }

    // RadianからDegree（度）に変換する
    let longitude = (lngRad / TinyOrbit.TORAD) % 360;
    if (longitude > 180) {
        longitude = 360 - longitude;
    } else if(longitude < -180) {
        longitude = 360 + longitude;
    }
    const latitude = latRad / TinyOrbit.TORAD;

    return [latitude, longitude];
};

TinyOrbit.Orbit.prototype.getLat = function () {
    return this.latitude;
};

TinyOrbit.Orbit.prototype.getLon = function () {
    return this.longitude;
};
