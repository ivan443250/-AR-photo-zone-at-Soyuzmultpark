using UnityEngine;
using UnityEngine.SceneManagement;

namespace SoyuzmultparkWebAR 
{
    public class SceneLoader : MonoBehaviour
    {
        private void Start()
        {
            DontDestroyOnLoad(gameObject);
        }

        public void ChangeScene(int newSceneIndex)
        {
            SceneManager.LoadScene(newSceneIndex);
        }
    }
}