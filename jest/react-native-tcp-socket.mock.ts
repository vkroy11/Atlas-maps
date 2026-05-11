/**
 * Jest stub for `react-native-tcp-socket`.
 *
 * Tests only exercise the pure parser / response-builder helpers; the actual
 * server can't run under Node Jest. This stub satisfies imports without
 * pulling in the native module.
 */

const TcpSocket = {
  createServer: () => {
    throw new Error('TcpSocket.createServer is unavailable in tests');
  },
};

export default TcpSocket;
