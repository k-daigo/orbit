/**
 * Vueのコンフィグ
 */

module.exports = {
    devServer: {
        port: 13061,
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
