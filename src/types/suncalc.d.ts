declare module 'suncalc' {
  export function getTimes(
    date: Date,
    latitude: number,
    longitude: number,
  ): {
    sunrise: Date;
    sunset: Date;
    [key: string]: Date;
  };
}
