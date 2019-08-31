var TinyOrbit = {
    version: '1.2.1',
    /**
     * @namespace
     */
    util: {}
};

/**
 * takes a Date instance and return julian day
 * 指定日付のユリウス通日を返す
 * ユリウス通日（西暦 -4712年1月1日の正午（世界時）からの日数）
 * @param   {Date} date - Date instance
 * @returns {float}
 */
TinyOrbit.util.jday = function(date) {
    return (date.getTime() / 86400000.0) + 2440587.5;
};

/**
 * takes a Date instance and returns Greenwich mean sidereal time in radii
 * @param   {Date} date - Date instance
 * @returns {float}
 */
TinyOrbit.util.gmst = function(date) {
    const jd = TinyOrbit.util.jday(date);
    //t is the time difference in Julian centuries of Universal Time (UT1) from J2000.0.
    const t = (jd - 2451545.0) / 36525;
    // based on http://www.space-plasma.qmul.ac.uk/heliocoords/systems2art/node10.html
    let gmst = 67310.54841 + (876600.0*3600 + 8640184.812866) * t + 0.093104 * t*t - 0.0000062 * t*t*t;
    gmst = (gmst * (Math.PI/180) / 240.0) % (Math.PI*2);
    gmst += (gmst<0) ? Math.PI*2 : 0;
    return gmst;
};

/**
 *Initializes a Satellite object (requires Google Maps API3)
 * @class
 */
TinyOrbit.Satellite = function(tle) {
    "use strict";
    this.tle = tle;
    this.position = null;
    this.orbit = null;
    this.date = null;
    this.orbit = new TinyOrbit.Orbit(tle);

    // refresh
    this.refresh();
};

/**
 * Set a Date instance or null to use the current datetime.
 * Call refresh() to update the position afterward.
 * @param   {Date} date - An instance of Date
 */
TinyOrbit.Satellite.prototype.setDate = function(date) {
    this.date = date;
};

/**
 *Recalculates the position and updates the markers
 */
TinyOrbit.Satellite.prototype.refresh = function() {
    if(this.orbit === null) {
        return;
    }

    this.orbit.setDate(this.date);
    this.orbit.calc();
    this.lat = this.orbit.getLat();
    this.lon = this.orbit.getLon();
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
 * Parses TLE string and sets the proporties
 * @param {string} tleText - A TLE string of 3 lines
 */
TinyOrbit.TLE.prototype.parse = function (tleText) {
    "use strict";
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
    const a = TinyOrbit.util.jday(date);
    const b = TinyOrbit.util.jday(new Date(Date.UTC(this.epochYear, 0, 0, 0, 0, 0) + this.epochDay * 86400000));
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
    "use strict";
    this.tle = tleObj;
    this.date = null;

    // init constants
    this.ck2 = 5.413080e-4;
    this.ck4 = 0.62098875e-6;
    this.e6a = 1.0e-6;
    this.qoms2t = 1.88027916e-9;
    this.s = 1.01222928;
    this.xj3 = -0.253881e-5;
    this.xke = 0.743669161e-1;
    this.xkmper = 6378.137; // Earth's radius WGS-84
    this.xflat = 0.00335281066; // WGS-84 flattening
    this.xminpday = 1440.0;
    this.ae = 1.0;
    this.pi = Math.PI;
    this.pio2 = this.pi / 2;
    this.twopi = 2 * this.pi;
    this.x3pio2 = 3 * this.pio2;

    this.torad = this.pi/180;
    this.tothrd = 0.66666667;

    this.xinc = this.tle.inclination * this.torad;
    this.xnodeo = this.tle.rightAscension * this.torad;
    this.eo = this.tle.eccentricity;
    this.omegao  = this.tle.argumentOfPerigee * this.torad;

    // degreeである平均近点角（Mean Anomaly）をradianに変換
    this.xmo = this.tle.meanAnomaly * this.torad;

    this.xno = this.tle.meanMotion * this.twopi / 1440.0;
    this.bstar = this.tle.bstar;

    // recover orignal mean motion (xnodp) and semimajor axis (adop)
    // 元の平均運動（xnodp）と半長軸（adop）を復元する
    const a1 = Math.pow(this.xke / this.xno, this.tothrd);
    const cosio = Math.cos(this.xinc);
    const theta2 = cosio*cosio;
    const x3thm1 = 3.0 * theta2 - 1;
    const eosq = this.eo * this.eo;
    const betao2= 1.0 - eosq;
    const betao = Math.sqrt(betao2);
    const del1 = 1.5 * this.ck2 * x3thm1 / (a1*a1 * betao*betao2);
    const ao = a1 * (1 - del1 * ((1.0/3.0) + del1 * (1.0 + (134.0/81.0) * del1)));
    const delo = 1.5 * this.ck2 * x3thm1/(ao * ao * betao * betao2);
    const xnodp = this.xno/(1.0 + delo); //original_mean_motion
    const aodp = ao / (1.0 - delo); //semi_major_axis

    // initialization
    this.isimp = ((aodp*(1.0-this.eo)/this.ae) < (220.0/this.xkmper+this.ae)) ? 1 : 0;

    let s4 = this.s;
    let qoms24 = this.qoms2t;
    const perige = (aodp * (1.0-this.eo) - this.ae) * this.xkmper;
    if (perige < 156.0){
        s4 = perige - 78.0;
        if (perige <= 98.0){
          s4 = 20.0;
        } else {
          qoms24 = Math.pow(((120.0 - s4)*this.ae/this.xkmper), 4);
          s4 = s4/this.xkmper+this.ae;
        }
    }
    const pinvsq = 1.0/(aodp * aodp * betao2 * betao2);
    const tsi = 1.0/(aodp - s4);
    const eta = aodp * this.eo * tsi;
    const etasq = eta * eta;
    const eeta = this.eo * eta;
    const psisq = Math.abs(1.0 - etasq);
    const coef = qoms24 * Math.pow(tsi,4);
    const coef1 = coef/Math.pow(psisq,3.5);

    const c2 = coef1 * xnodp * (aodp * (1.0 + 1.5 * etasq + eeta * (4.0 + etasq)) + 0.75 * this.ck2 * tsi/psisq * x3thm1 * (8.0 + 3.0 * etasq * (8.0 + etasq)));
    const c1 = this.bstar * c2;
    const sinio = Math.sin(this.xinc);
    const a3ovk2 = -this.xj3/this.ck2 * Math.pow(this.ae,3);
    const c3 = coef * tsi * a3ovk2 * xnodp * this.ae * sinio/this.eo;
    const x1mth2 = 1.0 - theta2;
    const c4 = 2.0 * xnodp * coef1 * aodp * betao2 * (eta * (2.0 + 0.5 * etasq) + this.eo * (0.5 + 2.0 * etasq) - 2.0 * this.ck2 * tsi/(aodp * psisq) * (-3.0 * x3thm1 * (1.0 - 2.0 * eeta + etasq * (1.5 - 0.5 * eeta)) + 0.75 * x1mth2 * (2.0 * etasq - eeta * (1.0 + etasq)) * Math.cos((2.0 * this.omegao))));
    this.c5 = 2.0 * coef1 * aodp * betao2 * (1.0 + 2.75 * (etasq + eeta) + eeta * etasq);

    const theta4 = theta2 * theta2;
    const temp1 = 3.0 * this.ck2 * pinvsq * xnodp;
    const temp2 = temp1 * this.ck2 * pinvsq;
    const temp3 = 1.25 * this.ck4 * pinvsq * pinvsq * xnodp;
    this.xmdot = xnodp + 0.5 * temp1 * betao * x3thm1 + 0.0625 * temp2 * betao * (13.0 - 78.0 * theta2 + 137.0 * theta4);
    const x1m5th = 1.0 - 5.0 * theta2;
    this.omgdot = -0.5 * temp1 * x1m5th + 0.0625 * temp2 * (7.0 - 114.0 * theta2 + 395.0 * theta4) + temp3 * (3.0 - 36.0 * theta2 + 49.0 * theta4);
    const xhdot1 = -temp1 * cosio;
    this.xnodot = xhdot1 + (0.5 * temp2 * (4.0 - 19.0 * theta2) + 2.0 * temp3 * (3.0 - 7.0 * theta2)) * cosio;
    this.omgcof = this.bstar * c3 * Math.cos(this.omegao);
    this.xmcof = -this.tothrd * coef * this.bstar * this.ae/eeta;
    this.xnodcf = 3.5 * betao2 * xhdot1 * c1;
    this.t2cof = 1.5 * c1;
    this.xlcof = 0.125 * a3ovk2 * sinio * (3.0 + 5.0 * cosio)/(1.0 + cosio);
    this.aycof = 0.25 * a3ovk2 * sinio;
    this.delmo = Math.pow((1.0 + eta * Math.cos(this.xmo)),3);
    this.sinmo = Math.sin(this.xmo);
    this.x7thm1 = 7.0 * theta2 - 1.0;

    let d2, d3, d4;
    if (this.isimp != 1){
        const c1sq = c1 * c1;
        d2 = 4.0 * aodp * tsi * c1sq;
        const temp = d2 * tsi * c1/3.0;
        d3 = (17.0 * aodp + s4) * temp;
        d4 = 0.5 * temp * aodp * tsi * (221.0 * aodp + 31.0 * s4) * c1;
        this.t3cof = d2 + 2.0 * c1sq;
        this.t4cof = 0.25 * (3.0 * d3 + c1 * (12.0 * d2 + 10.0 * c1sq));
        this.t5cof = 0.2 * (3.0 * d4 + 12.0 * c1 * d3 + 6.0 * d2 * d2 + 15.0 * c1sq * (2.0 * d2 + c1sq));
    }

    // set variables that are needed in the calculate() routine
    this.aodp = aodp;
    this.c1 = c1;
    this.c4 = c4;
    this.cosio = cosio;
    this.d2 = d2;
    this.d3 = d3;
    this.d4 = d4;
    this.eta = eta;
    this.sinio = sinio;
    this.x3thm1 = x3thm1;
    this.x1mth2 = x1mth2;
    this.xnodp = xnodp;
};

/**
 *calculates position and velocity vectors based date set on the Orbit object
 * Orbitに設定された日付に基づいて緯度経度を計算する
 */
TinyOrbit.Orbit.prototype.calc = function() {
    "use strict";
    const date = (this.date === null) ? new Date() : this.date;

    // 日付とTLEのエポックとの差を分単位で取得する
    const tsince = this.tle.dtime(date);

    // update for secular gravity and atmospheric drag
    // 長期重力と大気抵抗の更新

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
    let a = this.aodp * tempa * tempa;
    // 離心率
    const e = this.eo - tempe;
    const xl = xmp + omega + xnode + this.xnodp * templ;
    const beta = Math.sqrt(1.0 - e*e);
    const xn = this.xke/Math.pow(a,1.5);

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
        const epw = (capu - temp4 + temp3 - temp2)/(1.0 - temp5 - temp6) + temp2;
        if (Math.abs(epw - temp2) <= this.e6a){
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
    const rdot = this.xke * Math.sqrt(a) * esine * temp1;
    const rfdot = this.xke * Math.sqrt(pl) * temp1;
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
    temp1 = this.ck2 * temp;
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
    // kmでの位置と速度
    this.x = (rk * ux) * this.xkmper;
    this.y = (rk * uy) * this.xkmper;
    this.z = (rk * uz) * this.xkmper;
    this.xdot = (rdotk * ux + rfdotk * vx) * this.xkmper;
    this.ydot = (rdotk * uy + rfdotk * vy) * this.xkmper;
    this.zdot = (rdotk * uz + rfdotk * vz) * this.xkmper;

    /**
     * orbit period in seconds
     * 秒単位の軌道周期
     * @type {float}
     * @readonly
     */
    this.period = this.twopi * Math.sqrt(Math.pow(this.aodp * this.xkmper , 3) / 398600.4);

    /**
     * velocity in km per second
     * 速度（km /秒）
     * @type {float}
     * @readonly
     */
    this.velocity = Math.sqrt(this.xdot*this.xdot + this.ydot*this.ydot + this.zdot*this.zdot) / 60; // kmps

    // lat, lon and altitude
    // 緯度、経度、高度
    // based on http://www.celestrak.com/columns/v02n03/

    // 地球半径
    a = 6378.137;
    // 地球内側半径
    const b = 6356.7523142;
    // 
    const R = Math.sqrt(this.x * this.x + this.y * this.y);
    // 
    const f = (a - b) / a;
    // グリニッジ平均恒星時
    const gmst = TinyOrbit.util.gmst(date);

    const e2 = ((2*f) - (f*f));
    // 緯度経度
    let longitude = Math.atan2(this.y, this.x) - gmst;
    let latitude = Math.atan2(this.z, R);

    let C;
    let iterations = 20;
    while(iterations--) {
        C = 1 / Math.sqrt( 1 - e2*(Math.sin(latitude)*Math.sin(latitude)) );
        latitude = Math.atan2 (this.z + (a*C*e2*Math.sin(latitude)), R);
    }

    /**
     * Altitude in kms
     * 高度（km）
     * @type {float}
     * @readonly
     */
    this.altitude = (R/Math.cos(latitude)) - (a*C);

    // convert from radii to degrees
    // 半径から度に変換する
    longitude  = (longitude / this.torad) % 360;
    if (longitude > 180) {
        longitude = 360 - longitude;
    } else if(longitude < -180) {
        longitude = 360 + longitude;
    }
    latitude  = (latitude / this.torad);

    /**
     * latitude in degrees
     * 緯度
     * @type {float}
     * @readonly
     */
    this.latitude = latitude;

    /**
     * longtitude in degrees
     * 経度
     * @type {float}
     * @readonly
     */
    this.longitude = longitude;
};

/**
 * Change the datetime, or null for to use current
 * @param {Date} date
 */
TinyOrbit.Orbit.prototype.setDate = function(date) {
    this.date = date;
};


TinyOrbit.Orbit.prototype.getLat = function () {
    return this.latitude;
};

TinyOrbit.Orbit.prototype.getLon = function () {
    return this.longitude;
};
