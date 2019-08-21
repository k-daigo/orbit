/**
 * Vueのコンフィグ
 */

module.exports = {
    devServer: {
        port: 19876,
        disableHostCheck: true,
        contentBase: './public',

        // CORSでバックと通信できないので、proxyして通す
        proxy: {
            '^/NORAD': {
                target: "https://www.celestrak.com",
                ws: true,
                changeOrigin: true
            },
        }
    }
}
