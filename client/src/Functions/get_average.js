function get_average(arr) {
    if (!Array.isArray(arr) || arr.length === 0) {
        return 0;
    }
    const sum = arr.reduce((acc, num) => acc + num, 0);
    return sum / arr.length;
}


export default get_average;